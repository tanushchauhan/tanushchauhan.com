import os from "node:os";
import { lt } from "drizzle-orm";
import { db } from "../db/index.ts";
import { HUB_SLUG, metricSamples } from "../db/schema.ts";
import { registerHub } from "./moontower.ts";

/**
 * Whole-machine metrics for the hub. /proc/stat and /proc/meminfo are not
 * namespaced, so a container reads the host's figures from them directly.
 * node:os is the fallback on macOS.
 *
 * Memory used is MemTotal - MemAvailable, as `free` reports it, and CPU busy
 * time excludes iowait.
 */

// overridable so parsing can be tested against fixtures
const PROC = Bun.env.PROC_ROOT ?? "/proc";
const SAMPLE_MS = 30_000;
const RETAIN_MS = 24 * 60 * 60 * 1000;
const PRUNE_EVERY = 20; // ticks, so roughly every 10 minutes

const readProc = async (name: string) => {
  try {
    const file = Bun.file(`${PROC}/${name}`);
    if (!(await file.exists())) return null;
    return await file.text();
  } catch {
    return null;
  }
};

/* ---------- CPU ---------- */
type CpuReading = { at: number; busy: number; total: number };
let previous: CpuReading | null = null;

/**
 * The aggregate `cpu` line of /proc/stat, in jiffies:
 *   cpu user nice system idle iowait irq softirq steal guest guest_nice
 */
const parseProcStat = (raw: string): CpuReading | null => {
  const line = raw.split("\n").find((l) => l.startsWith("cpu "));
  if (!line) return null;

  const fields = line.trim().split(/\s+/).slice(1).map(Number);
  if (fields.length < 5 || fields.some(Number.isNaN)) return null;

  const [user = 0, nice = 0, system = 0, idle = 0, iowait = 0, irq = 0, softirq = 0, steal = 0] = fields;
  const total = user + nice + system + idle + iowait + irq + softirq + steal;
  return { at: Date.now(), busy: total - idle - iowait, total };
};

const cpuFromOs = (): CpuReading => {
  let busy = 0;
  let total = 0;
  for (const cpu of os.cpus()) {
    for (const [state, ticks] of Object.entries(cpu.times)) {
      total += ticks;
      if (state !== "idle") busy += ticks;
    }
  }
  return { at: Date.now(), busy, total };
};

const cpuReading = async (): Promise<{ reading: CpuReading; source: "proc" | "os" }> => {
  const raw = await readProc("stat");
  const parsed = raw ? parseProcStat(raw) : null;
  return parsed ? { reading: parsed, source: "proc" } : { reading: cpuFromOs(), source: "os" };
};

const cpuPercent = (now: CpuReading, before: CpuReading) => {
  const span = now.total - before.total;
  if (span <= 0) return null;
  const pct = ((now.busy - before.busy) / span) * 100;
  return Math.min(100, Math.max(0, pct));
};

/* ---------- memory ---------- */
const parseMeminfo = (raw: string) => {
  const value = (key: string) => {
    const line = raw.split("\n").find((l) => l.startsWith(`${key}:`));
    if (!line) return null;
    const kb = Number(line.split(/\s+/)[1]);
    return Number.isNaN(kb) ? null : kb * 1024;
  };

  const total = value("MemTotal");
  const available = value("MemAvailable");
  if (total === null || available === null) return null;
  return { usedBytes: total - available, totalBytes: total, source: "proc" as const };
};

export const readMemory = async () => {
  const raw = await readProc("meminfo");
  const parsed = raw ? parseMeminfo(raw) : null;
  if (parsed) return parsed;

  // macOS keeps almost no free pages, so this reads high in development
  return {
    usedBytes: os.totalmem() - os.freemem(),
    totalBytes: os.totalmem(),
    source: "os" as const,
  };
};

const MB = 1024 * 1024;
const GB = 1024 * MB;

/* ---------- disk ----------
 * On overlay2 this reports the host disk. DISK_PATH can point it at a host
 * volume if that ever stops matching `df /`.
 */
const DISK_PATH = Bun.env.DISK_PATH ?? "/";

const readDisk = async () => {
  try {
    const { statfs } = await import("node:fs/promises");
    const fs = await statfs(DISK_PATH);
    const total = Number(fs.blocks) * Number(fs.bsize);
    // blocks - bfree, like df: the root reserve counts as free
    const used = (Number(fs.blocks) - Number(fs.bfree)) * Number(fs.bsize);
    if (!total) return null;
    return {
      diskPct: Number(((used / total) * 100).toFixed(1)),
      diskUsedGb: Number((used / GB).toFixed(1)),
      diskTotalGb: Number((total / GB).toFixed(1)),
    };
  } catch {
    return null;
  }
};

/** One reading of everything, with CPU measured against the previous call. */
export const sample = async () => {
  const { reading, source } = await cpuReading();
  const pct = previous ? cpuPercent(reading, previous) : null;
  previous = reading;

  const memory = await readMemory();
  const memPct = memory.totalBytes ? (memory.usedBytes / memory.totalBytes) * 100 : 0;
  const disk = await readDisk();

  return {
    cpuPct: pct === null ? null : Number(pct.toFixed(1)),
    cores: os.cpus().length,
    ...(disk ?? { diskPct: null, diskUsedGb: null, diskTotalGb: null }),
    load1: Number(os.loadavg()[0].toFixed(2)),
    memPct: Number(memPct.toFixed(1)),
    memUsedMb: Math.round(memory.usedBytes / MB),
    memTotalMb: Math.round(memory.totalBytes / MB),
    source: source === "proc" && memory.source === "proc" ? ("proc" as const) : ("os" as const),
    // the site's own memory, so a leak here is visible on its own
    appMemMb: Math.round(process.memoryUsage.rss() / MB),
    hostUptimeSeconds: Math.floor(os.uptime()),
  };
};

export type Sample = Awaited<ReturnType<typeof sample>>;

let latest: Sample | null = null;
export const latestSample = () => latest;

/** Samples every 30 seconds and keeps a day of history. Errors are logged, never thrown. */
export const startMetricsSampler = () => {
  let ticks = 0;

  const tick = async () => {
    try {
      const reading = await sample();
      latest = reading;
      if (reading.cpuPct === null) return; // the priming read, nothing to store

      await db.insert(metricSamples).values({
        server: HUB_SLUG,
        cpuPct: reading.cpuPct,
        memPct: reading.memPct,
        memUsedMb: reading.memUsedMb,
        memTotalMb: reading.memTotalMb,
        diskPct: reading.diskPct,
        diskUsedGb: reading.diskUsedGb,
        diskTotalGb: reading.diskTotalGb,
        load1: reading.load1,
      });

      await registerHub(reading.cores, `${os.type()} ${os.release()}`);

      if (++ticks % PRUNE_EVERY === 0) {
        await db
          .delete(metricSamples)
          .where(lt(metricSamples.at, new Date(Date.now() - RETAIN_MS)));
      }
    } catch (error) {
      console.warn("metrics sample failed:", error);
    }
  };

  void tick(); // primes the CPU delta so the first stored sample is real
  const timer = setInterval(tick, SAMPLE_MS);
  return () => clearInterval(timer);
};
