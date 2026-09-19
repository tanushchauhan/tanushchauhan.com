import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { Draggable } from "gsap/Draggable";
import { useGSAP } from "@gsap/react";
import dayjs from "dayjs";
import clsx from "clsx";
import useWindowStore from "#store/window.js";
import useAuthStore from "#store/auth.js";
import { Bar, Heatmap, Sparkline } from "./Sparkline.jsx";
import { onRefreshWidgets } from "../../utils/widgets.js";
import { Sun, Moon, Grid3x3, GitCommitVertical, Box, Activity, Globe, Network } from "lucide-react";

gsap.registerPlugin(Draggable);

const POLL_MS = 15 * 60 * 1000;
const SYSTEM_POLL_MS = 30 * 1000;

/** Each card sets --accent, which the chip, sha pill and live dot all use. */
const Head = ({ icon, children }) => (
  <header>
    <span className="ico">{icon}</span>
    {children}
  </header>
);

/* ---------- Austin clock ---------- */
const AustinClock = () => {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const tick = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(tick);
  }, []);

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(now);

  const get = (type) => parts.find((p) => p.type === type)?.value ?? "";
  const hour24 = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Chicago",
      hour: "numeric",
      hour12: false,
    }).format(now)
  );

  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    weekday: "long",
  }).format(now);

  const asleep = hour24 >= 2 && hour24 < 9;

  return (
    <article
      className="widget w-clock"
      style={{ "--accent": asleep ? "#8ea2f6" : "#f5a524" }}
    >
      <Head icon={asleep ? <Moon /> : <Sun />}>Austin, TX</Head>
      <div className="body">
        <p className="big">
          {get("hour")}:{get("minute")}
          <span className="unit">{get("dayPeriod")}</span>
        </p>
        <p className="sub">
          <i className="dot" />
          {weekday} · {asleep ? "probably asleep" : "probably around"}
        </p>
      </div>
    </article>
  );
};

/* ---------- GitHub contributions ---------- */
const Contributions = ({ data }) => (
  <article className="widget w-contrib" style={{ "--accent": "#f08a2d" }}>
    <Head icon={<Grid3x3 />}>Contributions</Head>
    {data?.available ? (
      <>
        <p className="big">
          {data.total.toLocaleString()}
          <span className="unit">this year</span>
        </p>
        <Heatmap days={data.days} />
        {data.private > 0 && (
          <p className="sub">
            {data.private.toLocaleString()} in private repos
          </p>
        )}
      </>
    ) : (
      <p className="empty">
        {data?.reason === "GITHUB_TOKEN is not set"
          ? "Set GITHUB_TOKEN to light this up."
          : "GitHub is quiet right now."}
      </p>
    )}
  </article>
);

/* ---------- latest commit ---------- */
const LatestCommit = ({ data }) => (
  <article className="widget w-commit" style={{ "--accent": "#5fd39b" }}>
    <Head icon={<GitCommitVertical />}>Latest commit</Head>
    {data?.available ? (
      <>
        <p className="repo">{data.repo}</p>
        <p className="msg">{data.message}</p>
        <p className="sub meta">
          {data.url ? (
            <a className="sha" href={data.url} target="_blank" rel="noopener noreferrer">
              {data.sha}
            </a>
          ) : (
            <span className="sha">{data.sha}</span>
          )}
          <span className="whitespace-nowrap">
            {dayjs(data.at).format("MMM D, YYYY")}
          </span>
        </p>
      </>
    ) : (
      <p className="empty">
        {data?.reason === "no public repos"
          ? "No public repos yet."
          : "Nothing public to show."}
      </p>
    )}
  </article>
);

/* ---------- now building ---------- */
const NowBuilding = ({ data }) => (
  <article className="widget w-building" style={{ "--accent": "#a78bfa" }}>
    <Head icon={<Box />}>Now building</Head>
    {data?.text ? (
      <>
        <p className="msg lead">{data.text}</p>
        {data.updatedAt && (
          <p className="sub meta">updated {dayjs(data.updatedAt).format("MMM D")}</p>
        )}
      </>
    ) : (
      <p className="empty">Nothing set. Run `building &lt;text&gt;` in the terminal.</p>
    )}
  </article>
);

/* ---------- system (signed in only) ---------- */
const duration = (seconds) => {
  if (!Number.isFinite(seconds)) return "n/a";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d) return `${d}d ${h}h`;
  if (h) return `${h}h ${m}m`;
  return `${m}m`;
};

/** `values` draws a sparkline, `pct` draws a fill bar. */
const Stat = ({ label, value, unit, values, pct, warn }) => (
  <div className={clsx("stat", warn && "warn")}>
    <p className="k">{label}</p>
    <p className="v">
      {value}
      {unit && <span className="unit">{unit}</span>}
    </p>
    {/* the CSS sets `color` on the svg, since var() in SVG attributes is unreliable */}
    {pct == null ? <Sparkline values={values} height={22} /> : <Bar pct={pct} />}
  </div>
);

const gb = (mb) => (mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${mb} MB`);

// "4.2 / 8.0 GB", with the unit once, so it fits a third of a half-width card
const gbValue = (mb) => (mb >= 1024 ? (mb / 1024).toFixed(1) : String(mb));
const gbUnit = (mb) => (mb >= 1024 ? "GB" : "MB");

/* ---------- Moontower ---------- */
const System = ({ data }) => {
  const fleet = data?.servers ?? [];
  const [active, setActive] = useState(0);
  // the tab's server may have been removed
  const server = fleet[Math.min(active, Math.max(0, fleet.length - 1))] ?? null;
  const s = server?.sample;
  const history = server?.history ?? [];

  return (
    <article className="widget w-system" style={{ "--accent": "#5eb0ef" }}>
      <Head icon={<Activity />}>
        Moontower
        {data && (
          <span className="tail">
            {server?.uptimeSeconds != null && `up ${duration(server.uptimeSeconds)}`}
            {/* amber once load exceeds the core count */}
            {s?.load1 != null && (
              <span className={clsx(server?.cores && s.load1 > server.cores && "warn")}>
                {" · "}load {s.load1.toFixed(2)}
              </span>
            )}
            {server?.cores != null && ` · ${server.cores} cores`}
          </span>
        )}
      </Head>

      {fleet.length > 1 && (
        <div className="tabs" role="tablist">
          {fleet.map((srv, i) => (
            <button
              key={srv.slug}
              type="button"
              role="tab"
              aria-selected={i === active}
              className={clsx(i === active && "on", srv.stale && "stale")}
              onClick={() => setActive(i)}
            >
              {srv.name}
              {srv.stale && <i className="dot-stale" aria-label="not reporting" />}
            </button>
          ))}
        </div>
      )}

      {/* collapsed summary of every machine, shown by the fit tiers */}
      {fleet.length > 0 && (
        <p className="glance">
          {fleet.map((srv) => {
            const down = srv.units?.filter((u) => u.a !== "active").length ?? 0;
            return (
              <span key={srv.slug} className={clsx((srv.stale || down) && "warn")}>
                <b>{srv.name}</b>
                {srv.stale
                  ? " not reporting"
                  : down
                    ? ` ${down} unit${down === 1 ? "" : "s"} down`
                    : [
                        srv.sample?.cpuPct != null && ` ${srv.sample.cpuPct.toFixed(1)}% cpu`,
                        srv.sample?.diskPct != null && ` · ${Math.round(srv.sample.diskPct)}% disk`,
                      ]
                        .filter(Boolean)
                        .join("")}
              </span>
            );
          })}
        </p>
      )}

      {server ? (
        <>
          <div className={clsx("stats", s?.diskPct != null && "three")}>
            <Stat
              label="CPU"
              value={s?.cpuPct ?? "n/a"}
              unit={s?.cpuPct == null ? "" : "%"}
              values={history.map((h) => h.cpuPct)}
            />
            <Stat
              label="Memory"
              value={s?.memUsedMb != null ? gbValue(s.memUsedMb) : "n/a"}
              unit={
                s?.memUsedMb == null
                  ? ""
                  : s.memTotalMb
                    ? ` / ${Math.round(s.memTotalMb / 1024)} GB`
                    : ` ${gbUnit(s.memUsedMb)}`
              }
              values={history.map((h) => h.memPct)}
            />
            {s?.diskPct != null && (
              <Stat
                label="Disk"
                value={s.diskUsedGb != null ? `${Math.round(s.diskUsedGb)}` : Math.round(s.diskPct)}
                unit={
                  s.diskUsedGb != null && s.diskTotalGb != null
                    ? ` / ${Math.round(s.diskTotalGb)} GB`
                    : "%"
                }
                pct={s.diskPct}
                warn={s.diskPct >= 85}
              />
            )}
          </div>
          {server.units?.length > 0 && (
            <p className="sub units">
              {(() => {
                const broken = server.units.filter((u) => u.a !== "active");
                const flapping = server.units.filter((u) => u.r > 0);
                if (broken.length) {
                  return (
                    <span className="warn">
                      <i className="dot-bad" />
                      {broken.map((u) => u.n.replace(/\.service$/, "")).join(", ")}{" "}
                      {broken.length === 1 ? "is" : "are"} not running
                    </span>
                  );
                }
                return (
                  <>
                    <i className="dot-ok" />
                    {server.units.length} units healthy
                    {server.failedUnits > 0 && (
                      <span className="warn"> · {server.failedUnits} failed elsewhere</span>
                    )}
                    {/* up, but restarting repeatedly */}
                    {!server.failedUnits && flapping.length > 0 && (
                      <span className="warn">
                        {" "}
                        · {flapping[0].n.replace(/\.service$/, "")} restarted {flapping[0].r}x
                      </span>
                    )}
                  </>
                );
              })()}
            </p>
          )}

          <p className="sub app-mem">
            {server.stale ? (
              <span className="warn">
                not reporting · last seen{" "}
                {server.lastSeenAt
                  ? `${duration((Date.now() - new Date(server.lastSeenAt)) / 1000)} ago`
                  : "never"}
              </span>
            ) : (
              <>
                {server.appMemMb != null && `this site is using ${gb(server.appMemMb)}`}
                {server.slug === "hub" && data.deployedSecondsAgo != null &&
                  ` · deployed ${duration(data.deployedSecondsAgo)} ago`}
                {server.slug === "hub" && ` · ${data.env}`}
                {server.agentVersion && `agent ${server.agentVersion}`}
                {server.updateAvailable && (
                  <span className="warn"> · {data.version} available</span>
                )}
                {s?.source === "os" && " · dev machine figures, not a server"}
              </>
            )}
          </p>
        </>
      ) : (
        <p className="empty">Waiting for the first reading…</p>
      )}
    </article>
  );
};

/* ---------- tailnet ----------
 * Offline dims rather than turning red, since a closed laptop is not a fault.
 * Amber marks a pending update or a key close to expiry.
 */
const EXPIRY_WARN_MS = 14 * 86400 * 1000;

const Tailnet = ({ data }) => {
  const devices = data?.ok ? data.devices : [];
  const online = devices.filter((d) => d.online).length;

  const state = (d) => {
    if (d.online) return "online";
    const seconds = (Date.now() - new Date(d.lastSeen)) / 1000;
    return seconds >= 86400 ? `${Math.floor(seconds / 86400)}d ago` : `${duration(seconds)} ago`;
  };

  const detail = (d) =>
    [d.os, d.address, d.version && `v${d.version}`].filter(Boolean).join(" · ");

  const warning = (d) => {
    if (d.keyExpiry && new Date(d.keyExpiry) - Date.now() < EXPIRY_WARN_MS) {
      return `key expires ${dayjs(d.keyExpiry).format("MMM D")}`;
    }
    if (d.updateAvailable) return "update available";
    return null;
  };

  return (
    <article className="widget w-tailnet" style={{ "--accent": "#a5b4fc" }}>
      <Head icon={<Network />}>
        Tailnet
        {data?.ok && (
          <span className="tail">
            {online} of {devices.length} online
          </span>
        )}
      </Head>
      {data?.ok === false ? (
        <p className="empty">Tailscale is not answering: {data.error}</p>
      ) : (
        <ul className="devices">
          {devices.map((d) => (
            <li key={d.name} className={clsx(!d.online && "off")}>
              <p className="row">
                <i className={clsx("d", d.online ? "d-ok" : "d-off")} />
                <span className="n">{d.name}</span>
                <span className="t">{state(d)}</span>
              </p>
              <p className="detail">
                <span className="n">{detail(d)}</span>
                {warning(d) && <span className="warn">{warning(d)}</span>}
              </p>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
};

/* ---------- services ---------- */
const Services = ({ data }) => {
  const list = data?.services ?? [];
  // a stale reading is neither up nor down
  const unknown = list.filter((s) => s.ok === null || s.stale);
  const down = list.filter((s) => s.ok === false && !s.stale);
  const up = list.filter((s) => s.ok === true && !s.stale);
  // show the slowest; an average would hide it
  const latencies = up.map((s) => s.latencyMs).filter((v) => typeof v === "number");
  const slowest = latencies.length ? Math.max(...latencies) : null;
  const quiet = [...unknown, ...up];
  const tail = down.length
    ? `${down.length} down`
    : up.length
      ? `all ${up.length} up`
      : "no recent check";

  return (
    <article className="widget w-services" style={{ "--accent": "#2dd4bf" }}>
      <Head icon={<Globe />}>
        Services
        {list.length > 0 && <span className="tail">{tail}</span>}
      </Head>

      {list.length === 0 ? (
        <p className="empty">
          Nothing watched yet. In the terminal:
          <code>services add &lt;name&gt; &lt;url&gt;</code>
        </p>
      ) : (
        <>
          {/* only broken services get their own row */}
          <ul className="svc">
            {down.map((s) => (
              <li key={s.slug} className="bad">
                <i className="d d-bad" />
                <span className="n">{s.name}</span>
                <span className="t">
                  {s.since
                    ? `down ${duration((Date.now() - new Date(s.since)) / 1000)}`
                    : (s.error ?? "down")}
                </span>
              </li>
            ))}
            {quiet.map((s) => (
              <li key={s.slug} className="up">
                <i className={clsx("d", s.ok === true && !s.stale ? "d-ok" : "d-wait")} />
                <span className="n">{s.name}</span>
                <span className="t">
                  {s.stale ? "no check" : s.ok === null ? "checking" : `${s.latencyMs}ms`}
                </span>
              </li>
            ))}
          </ul>

          {/* the healthy ones as a single line; the fit tiers pick which to show */}
          {quiet.length > 0 && (
            <p className="sub healthy">
              <i className={clsx("d", unknown.length ? "d-wait" : "d-ok")} />
              <span className="n">{quiet.map((s) => s.name).join(" · ")}</span>
              {slowest != null && <span className="t">{slowest}ms</span>}
            </p>
          )}
        </>
      )}
    </article>
  );
};

/** Shared by the desktop grid and the mobile row. */
const useWidgetData = () => {
  const [github, setGithub] = useState(null);
  const [building, setBuilding] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (document.hidden) return;
      try {
        const [gh, b] = await Promise.all([
          fetch("/api/widgets/github").then((r) => (r.ok ? r.json() : null)),
          fetch("/api/widgets/building").then((r) => (r.ok ? r.json() : null)),
        ]);
        if (cancelled) return;
        if (gh) setGithub(gh);
        if (b) setBuilding(b);
      } catch {
      }
    };

    load();
    const timer = setInterval(load, POLL_MS);
    document.addEventListener("visibilitychange", load);
    // refresh right away after an edit from the terminal
    const stopListening = onRefreshWidgets(load);
    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", load);
      stopListening();
    };
  }, []);

  const authed = useAuthStore((s) => s.status === "authed");

  return { github, building, authed };
};

/** Polls only while signed in and the tab is visible. */
const useSystemData = (enabled) => {
  const [system, setSystem] = useState(null);

  useEffect(() => {
    if (!enabled) {
      setSystem(null);
      return;
    }

    let cancelled = false;

    const load = async () => {
      if (document.hidden) return;
      try {
        const res = await fetch("/api/moontower/fleet", {
          credentials: "same-origin",
        });
        if (!res.ok) return;
        const body = await res.json();
        if (!cancelled) setSystem(body);
      } catch {
      }
    };

    load();
    const timer = setInterval(load, SYSTEM_POLL_MS);
    document.addEventListener("visibilitychange", load);
    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", load);
    };
  }, [enabled]);

  return system;
};

/**
 * The cards, in order, for both layouts. `wide` cards span the full width on
 * mobile. Signed-in cards are appended so the others do not move.
 */
const cards = ({ github, building, system, authed }) => [
  { id: "clock", node: <AustinClock /> },
  { id: "building", node: <NowBuilding data={building} /> },
  { id: "contrib", wide: true, node: <Contributions data={github?.contributions} /> },
  { id: "commit", wide: true, node: <LatestCommit data={github?.latest} /> },
  ...(authed
    ? [
        { id: "system", wide: true, node: <System data={system} /> },
        { id: "services", wide: true, node: <Services data={system} /> },
        // only once the server has a Tailscale credential
        ...(system?.tailnet?.configured
          ? [{ id: "tailnet", wide: true, node: <Tailnet data={system.tailnet} /> }]
          : []),
      ]
    : []),
];

/* ---------- fitting above the dock ----------
 * How tall the block gets depends on its content, so CSS cannot keep it clear
 * of the dock. Each tier is tried in order until one fits; the last one stays
 * applied even if it does not.
 */
const FIT_TIERS = ["", "tight", "lean", "compact", "min", "core", "bare"];
const DOCK_CLEARANCE = 20;

/** Mobile: a grid on the first springboard page. The signed-in cards get their own page. */
export const MobileWidgets = () => {
  const data = useWidgetData();
  return (
    <div className="m-widgets">
      {cards({ ...data, authed: false }).map(({ id, node, wide }) => (
        <div key={id} className={clsx("widget-slot", wide && "wide")}>
          {node}
        </div>
      ))}
    </div>
  );
};

export const MobileSystem = () => {
  const authed = useAuthStore((s) => s.status === "authed");
  const system = useSystemData(authed);
  return (
    <div className="m-widgets">
      <div className="widget-slot wide">
        <System data={system} />
      </div>
      <div className="widget-slot wide">
        <Services data={system} />
      </div>
      {system?.tailnet?.configured && (
        <div className="widget-slot wide">
          <Tailnet data={system.tailnet} />
        </div>
      )}
    </div>
  );
};

/** Bump when the block's spacing changes, so old drag offsets are dropped. */
const GEOMETRY = 3;
const signature = (list) => `${GEOMETRY}:${list.map((c) => c.id).join(",")}`;

/** Restores a saved offset, clamped so a card cannot land off screen or under the dock. */
const restore = (el, pos, area) => {
  const base = el.getBoundingClientRect();
  const clamp = (v, lo, hi) => (hi < lo ? 0 : Math.min(hi, Math.max(lo, v)));
  gsap.set(el, {
    x: clamp(pos.x, area.left - base.left, area.right - base.right),
    y: clamp(pos.y, area.top - base.top, area.bottom - base.bottom),
  });
};

const Widgets = () => {
  const { widgetPos, setWidgetPos } = useWindowStore();
  const data = useWidgetData();
  const system = useSystemData(data.authed);
  const rootRef = useRef(null);

  const list = cards({ ...data, system });
  const layout = signature(list);

  useGSAP(
    () => {
      const slots = rootRef.current?.querySelectorAll(".widget-slot");
      if (!slots?.length) return;

      const main = rootRef.current.closest("main");
      const dock = document.querySelector("#dock");
      const bounds = main.getBoundingClientRect();
      const area = {
        left: bounds.left,
        top: bounds.top,
        right: bounds.right,
        bottom: dock ? dock.getBoundingClientRect().top - 8 : bounds.bottom,
      };

      // reset first: GSAP transforms outlive the previous layout
      gsap.set(slots, { x: 0, y: 0 });

      const saved = useWindowStore.getState().widgetPos[layout] ?? {};
      slots.forEach((el) => {
        const p = saved[el.dataset.id];
        if (p) restore(el, p, area);
      });

      const instances = Draggable.create(slots, {
        // the element, not a selector: useGSAP resolves selectors inside rootRef
        bounds: main,
        onDragEnd() {
          setWidgetPos(layout, this.target.dataset.id, { x: this.x, y: this.y });
        },
      });
      return () => instances.forEach((i) => i.kill());
    },
    // the session resolves after mount, which changes the card set
    { scope: rootRef, dependencies: [layout] }
  );

  useEffect(() => {
    const el = rootRef.current;
    const dock = document.querySelector("#dock");
    if (!el || !dock) return;

    const fit = () => {
      // a detached node measures as zero and would always "fit"
      if (!el.isConnected) return;
      for (const tier of FIT_TIERS) {
        el.dataset.fit = tier;
        const clear = dock.getBoundingClientRect().top - el.getBoundingClientRect().bottom;
        if (clear >= DOCK_CLEARANCE) return;
      }
    };

    fit();
    // a late webfont reflows the cards
    document.fonts?.ready.then(fit);
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [data.github, data.building, system, data.authed]);

  // Clean Up: snap every card home
  useEffect(() => {
    if (Object.keys(widgetPos).length === 0 && rootRef.current) {
      gsap.to(rootRef.current.querySelectorAll(".widget-slot"), {
        x: 0,
        y: 0,
        duration: 0.3,
        ease: "power2.out",
      });
    }
  }, [widgetPos]);

  return (
    <section
      id="widgets"
      className={clsx(data.authed && "authed", list.some((c) => c.id === "tailnet") && "with-tailnet")}
      ref={rootRef}
    >
      {list.map(({ id, node }) => (
        <div
          key={id}
          className="widget-slot"
          data-id={id}
        >
          {node}
        </div>
      ))}
    </section>
  );
};

export default Widgets;
