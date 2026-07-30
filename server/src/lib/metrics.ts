import os from "node:os";
import { lt } from "drizzle-orm";
import { db } from "../db/index.ts";
import { HUB_SLUG, metricSamples } from "../db/schema.ts";
import { registerHub } from "./moontower.ts";

/**
 * Whole-machine metrics for the hub server.
 *
 * These are the numbers for the entire box, not for this container. That
 * distinction cost a rewrite: the first version read cgroup v2, which describes
 * only what this container is using, so a Postgres container pegging a core
 * showed up here as 3%. The card is meant to answer "how is the server doing",
 * so it reads the machine.
 *
 * `/proc/stat` and `/proc/meminfo` are not namespaced, so a container reads the
 * host's real figures straight out of them with no privileges, no Docker socket
 * and no agent. `node:os` is the fallback for development on macOS.
 *
 * Two deliberate choices worth knowing:
 *  - memory used is MemTotal - MemAvailable, the number `free` calls "used".
 *    os.freemem() reports MemFree, which excludes reclaimable page cache and
 *    makes every healthy Linux box look 90%+ full.
 *  - CPU busy excludes both idle and iowait. Time blocked on disk is not the
 *    CPU doing work, and counting it makes a busy disk look like a busy CPU.
 */

// overridable so the parsing can be tested against fixtures rather than only
// against whatever the dev machine happens to report
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
    // absent on macOS, and a metrics read must never take the process down
    return null;
  }
};

/* ---------- CPU ----------
 * A CPU percentage is a rate, so it only exists between two readings. The
 * sampler keeps the previous one; until the second tick lands there is nothing
 * honest to report and this reports null rather than a made-up zero.
 */
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

/** macOS development fallback: the same arithmetic over os.cpus() tick counts. */
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
  // MemAvailable is the kernel's own estimate of what a new workload could
  // claim without swapping, which is the honest definition of free
  const available = value("MemAvailable");
  if (total === null || available === null) return null;
  return { usedBytes: total - available, totalBytes: total, source: "proc" as const };
};

export const readMemory = async () => {
  const raw = await readProc("meminfo");
  const parsed = raw ? parseMeminfo(raw) : null;
  if (parsed) return parsed;

  /*
   * Development only. On macOS this reads high: freemem() counts genuinely free
   * pages and macOS keeps almost none, using the rest for cache it hands back on
   * demand. The card reports which source answered so that is not mistaken for
   * a problem.
   */
  return {
    usedBytes: os.totalmem() - os.freemem(),
    totalBytes: os.totalmem(),
    source: "os" as const,
  };
};

const MB = 1024 * 1024;
const GB = 1024 * MB;

/* ---------- disk ----------
 * The one figure here that is not read out of /proc, because the kernel does
 * not put filesystem usage there. statfs is the same question `df` asks.
 *
 * Worth knowing, given the cgroup rewrite: inside a container this measures the
 * overlay filesystem, which for overlay2 sits on the host's disk and so reports
 * the host's real numbers. That is true of the normal Docker setup rather than
 * guaranteed by anything, so DISK_PATH exists to point it at a host volume if
 * hub ever stops agreeing with `df /` on the machine itself.
 */
const DISK_PATH = Bun.env.DISK_PATH ?? "/";

const readDisk = async () => {
  try {
    const { statfs } = await import("node:fs/promises");
    const fs = await statfs(DISK_PATH);
    const total = Number(fs.blocks) * Number(fs.bsize);
    // blocks - bfree, not bavail: bavail excludes the root reserve, and
    // counting reserved-but-unused space as used is what `df` does too
    const used = (Number(fs.blocks) - Number(fs.bfree)) * Number(fs.bsize);
    if (!total) return null;
    return {
      diskPct: Number(((used / total) * 100).toFixed(1)),
      diskUsedGb: Number((used / GB).toFixed(1)),
      diskTotalGb: Number((total / GB).toFixed(1)),
    };
  } catch {
    // statfs landed in Node 18.15 and is in Bun, but a metrics read must never
    // be the reason the site goes down
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
    // already a 1-minute average, so unlike CPU it needs no previous reading
    load1: Number(os.loadavg()[0].toFixed(2)),
    memPct: Number(memPct.toFixed(1)),
    memUsedMb: Math.round(memory.usedBytes / MB),
    memTotalMb: Math.round(memory.totalBytes / MB),
    // "proc" means these are the machine's real figures; "os" means a dev
    // machine's approximation
    source: source === "proc" && memory.source === "proc" ? ("proc" as const) : ("os" as const),
    // this process's own resident set, so a leak in the site itself is visible
    // separately from whatever else the box is doing
    appMemMb: Math.round(process.memoryUsage.rss() / MB),
    hostUptimeSeconds: Math.floor(os.uptime()),
  };
};

export type Sample = Awaited<ReturnType<typeof sample>>;

/** The most recent tick, so a request never has to wait for a CPU delta. */
let latest: Sample | null = null;
export const latestSample = () => latest;

/**
 * Samples on an interval and keeps a day of history, which is what gives the
 * sparklines a shape. Deliberately fire-and-forget: a database hiccup must not
 * take down the process, and a gap in a decorative chart is not worth a crash.
 */
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
