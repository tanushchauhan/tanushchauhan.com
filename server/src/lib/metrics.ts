import os from "node:os";
import { lt } from "drizzle-orm";
import { db } from "../db/index.ts";
import { metricSamples } from "../db/schema.ts";

/**
 * Host metrics for the authenticated widgets.
 *
 * The obvious implementation is `os.totalmem()` and `os.cpus()`, and inside a
 * container both of them lie: they report the whole host, so a 512 MB container
 * on a 16 GB box reads as "3% memory used" no matter how close it is to being
 * OOM-killed. Everything here prefers the cgroup v2 files, which describe what
 * this container actually has, and falls back to `node:os` only when they are
 * missing (running the server directly on macOS, for instance). Which source
 * answered is reported alongside the number rather than hidden.
 */

// overridable so the parsing can be tested against fixtures: the cgroup path is
// the one that runs in production and it is unreachable from a dev machine
const CGROUP = Bun.env.CGROUP_ROOT ?? "/sys/fs/cgroup";
const SAMPLE_MS = 30_000;
const RETAIN_MS = 24 * 60 * 60 * 1000;
const PRUNE_EVERY = 20; // ticks, so roughly every 10 minutes

const readCgroup = async (name: string) => {
  try {
    const file = Bun.file(`${CGROUP}/${name}`);
    if (!(await file.exists())) return null;
    return (await file.text()).trim();
  } catch {
    // reading cgroup files can fail on a host that namespaces them differently;
    // that is a fallback, not an error worth surfacing
    return null;
  }
};

/** Pulls `key N` out of a cgroup stat file. */
const statValue = (raw: string | null, key: string) => {
  const line = raw?.split("\n").find((l) => l.startsWith(`${key} `));
  return line ? Number(line.slice(key.length + 1)) : null;
};

/* ---------- CPU ----------
 * A CPU percentage is a rate, so it only exists between two readings. The
 * sampler keeps the previous one; until the second tick lands there is nothing
 * honest to report and this returns null rather than a made-up zero.
 */
type CpuReading = { at: number; busy: number; total: number | null };
let previous: CpuReading | null = null;

/** Cores this container may use: the cgroup quota, not the host's core count. */
const cpuAllowance = async () => {
  const raw = await readCgroup("cpu.max");
  if (!raw) return os.cpus().length;
  const [quota, period] = raw.split(/\s+/);
  if (quota === "max") return os.cpus().length;
  return Number(quota) / Number(period);
};

const cpuReading = async (): Promise<CpuReading> => {
  const usage = statValue(await readCgroup("cpu.stat"), "usage_usec");
  if (usage !== null) {
    // cgroup: CPU microseconds burned by this container, against wall clock
    return { at: Date.now(), busy: usage, total: null };
  }

  // host: aggregate jiffies across every core, busy being everything but idle
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

const cpuPercent = (now: CpuReading, before: CpuReading, cores: number) => {
  if (now.total !== null && before.total !== null) {
    const span = now.total - before.total;
    return span > 0 ? ((now.busy - before.busy) / span) * 100 : null;
  }

  const elapsedUs = (now.at - before.at) * 1000;
  if (elapsedUs <= 0 || cores <= 0) return null;
  const pct = ((now.busy - before.busy) / (elapsedUs * cores)) * 100;
  // a container that is throttled mid-window can briefly compute above 100
  return Math.min(100, Math.max(0, pct));
};

/* ---------- memory ---------- */
export const readMemory = async () => {
  const current = await readCgroup("memory.current");
  if (current !== null) {
    /*
     * memory.current includes the page cache, which grows to fill whatever is
     * available and is reclaimed under pressure rather than being a leak. This
     * subtracts the reclaimable part, the same arithmetic `docker stats` does,
     * so the number matches what you would see there.
     */
    const inactiveFile = statValue(await readCgroup("memory.stat"), "inactive_file") ?? 0;
    const limit = await readCgroup("memory.max");
    const totalBytes =
      limit && limit !== "max" ? Number(limit) : os.totalmem();
    const usedBytes = Math.max(0, Number(current) - inactiveFile);
    return { usedBytes, totalBytes, source: "cgroup" as const };
  }

  /*
   * Development only. Worth knowing that on macOS this reads near 100%:
   * freemem() counts genuinely free pages, and macOS keeps almost none, using
   * the rest for cache it will hand back on demand. The widget reports which
   * source it used precisely so that number is not mistaken for a problem.
   */
  return {
    usedBytes: os.totalmem() - os.freemem(),
    totalBytes: os.totalmem(),
    source: "os" as const,
  };
};

const MB = 1024 * 1024;

/** One reading of everything, with CPU measured against the previous call. */
export const sample = async () => {
  const cores = await cpuAllowance();
  const reading = await cpuReading();
  const pct = previous ? cpuPercent(reading, previous, cores) : null;
  previous = reading;

  const memory = await readMemory();
  const memPct = memory.totalBytes
    ? (memory.usedBytes / memory.totalBytes) * 100
    : 0;

  return {
    cpuPct: pct === null ? null : Number(pct.toFixed(1)),
    cores,
    cpuSource: reading.total === null ? ("cgroup" as const) : ("os" as const),
    memPct: Number(memPct.toFixed(1)),
    memUsedMb: Math.round(memory.usedBytes / MB),
    memTotalMb: Math.round(memory.totalBytes / MB),
    memSource: memory.source,
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
        cpuPct: reading.cpuPct,
        memPct: reading.memPct,
        memUsedMb: reading.memUsedMb,
      });

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
