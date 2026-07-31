import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { Draggable } from "gsap/Draggable";
import { useGSAP } from "@gsap/react";
import dayjs from "dayjs";
import clsx from "clsx";
import useWindowStore from "#store/window.js";
import useAuthStore from "#store/auth.js";
import { Bar, Heatmap, Sparkline } from "./Sparkline.jsx";
import { Sun, Moon, Grid3x3, GitCommitVertical, Box, Activity, Globe } from "lucide-react";

gsap.registerPlugin(Draggable);

const POLL_MS = 15 * 60 * 1000; // GitHub is cached for 5 min server-side anyway
const SYSTEM_POLL_MS = 30 * 1000; // matches the server's sampling interval

/**
 * One tinted glyph chip per card. The colour rides on the card as `--accent`
 * rather than being hardcoded here, so the chip and anything else that wants to
 * pick it up (the sha pill, the live dot) always agree.
 */
const Head = ({ icon, children }) => (
  <header>
    <span className="ico">{icon}</span>
    {children}
  </header>
);

/* ---------- Austin clock ----------
 * The menu bar already shows the visitor their own time, so repeating it would
 * be dead weight. What they cannot know is whether I am awake.
 */
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

  // rough waking hours, so the card says something a bare clock does not
  const asleep = hour24 >= 2 && hour24 < 9;

  return (
    <article
      className="widget w-clock"
      // amber while I am likely up, indigo overnight: the card reads at a
      // glance before you have parsed a single word of it
      style={{ "--accent": asleep ? "#8ea2f6" : "#f5a524" }}
    >
      <Head icon={asleep ? <Moon /> : <Sun />}>Austin, TX</Head>
      {/* centred, because the grid stretches every card to the tallest in the
          row and a clock has less to say than a heatmap */}
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
        {/* pushed to the bottom of the card: this row is a footer, and the grid
            stretches this card to the height of the heatmap beside it, which
            otherwise left a lot of dead space under the message */}
        <p className="sub meta">
          {data.url ? (
            <a className="sha" href={data.url} target="_blank" rel="noopener noreferrer">
              {data.sha}
            </a>
          ) : (
            <span className="sha">{data.sha}</span>
          )}
          {/* one unit: a narrow card was breaking the date after the comma */}
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

/* ---------- system ----------
 * Only rendered when I am signed in. The endpoint is behind requireAuth too:
 * hiding a card in the client would be decoration, not a boundary.
 */
const duration = (seconds) => {
  if (!Number.isFinite(seconds)) return "—";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d) return `${d}d ${h}h`;
  if (h) return `${h}h ${m}m`;
  return `${m}m`;
};

/**
 * `values` draws a sparkline, `pct` draws a fill bar. A rate wants its shape
 * over time; a capacity wants how much of it is gone.
 */
const Stat = ({ label, value, unit, values, pct, warn }) => (
  <div className={clsx("stat", warn && "warn")}>
    <p className="k">{label}</p>
    <p className="v">
      {value}
      {unit && <span className="unit">{unit}</span>}
    </p>
    {/* stroke stays currentColor: a var() in an SVG presentation attribute is
        not reliably supported, so the CSS sets `color` on the svg instead */}
    {pct == null ? <Sparkline values={values} height={22} /> : <Bar pct={pct} />}
  </div>
);

const gb = (mb) => (mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${mb} MB`);

/* Capacities read as "used / total UNIT", with the unit said once. Three stats
   on a half-width card leave about 113px each, and "4.2 GB / 8.0 GB" does not
   fit in that: it wrapped between the "8.0" and its "GB". */
const gbValue = (mb) => (mb >= 1024 ? (mb / 1024).toFixed(1) : String(mb));
const gbUnit = (mb) => (mb >= 1024 ? "GB" : "MB");

/*
 * Moontower: the fleet card. One tab per reporting machine, the hub itself
 * being just another row rather than a special case.
 *
 * Deliberately the shortest card here. It is a fifth card in a grid that was
 * already close to the dock, so the uptime and environment ride along in the
 * header rather than taking a line of their own.
 */
const System = ({ data }) => {
  const fleet = data?.servers ?? [];
  const [active, setActive] = useState(0);
  // a server disappearing (revoked while the tab is open) must not leave the
  // card pointing at nothing
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
            {/* Load rides next to the core count because one is meaningless
                without the other: 4.0 is a saturated 4-core box and a bored
                16-core one. Amber once there are more runnable processes than
                cores to run them, which is the point it starts queueing. */}
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

      {server ? (
        <>
          <div className={clsx("stats", s?.diskPct != null && "three")}>
            <Stat
              label="CPU"
              value={s?.cpuPct ?? "—"}
              unit={s?.cpuPct == null ? "" : "%"}
              values={history.map((h) => h.cpuPct)}
            />
            <Stat
              label="Memory"
              value={s?.memUsedMb != null ? gbValue(s.memUsedMb) : "—"}
              unit={
                s?.memUsedMb == null
                  ? ""
                  : s.memTotalMb
                    ? ` / ${Math.round(s.memTotalMb / 1024)} GB`
                    : ` ${gbUnit(s.memUsedMb)}`
              }
              values={history.map((h) => h.memPct)}
            />
            {/* only when the agent actually reported it: an older agent, or a
                machine where statfs failed, must not show a confident 0% */}
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
                // the number that actually needs to catch your eye, since a
                // full disk takes everything down and nothing else warns first
                warn={s.diskPct >= 85}
              />
            )}
          </div>
          {/* A summary, not a list. What matters at a glance is whether
              anything is broken; which unit it was is a question for the
              terminal, and twelve green dots on a card is just noise. */}
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
                    {/* a unit that is up but has restarted 40 times today is
                        the thing a plain up/down dot hides completely */}
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
              /* a frozen number presented as live is worse than no number */
              <span className="warn">
                not reporting · last seen{" "}
                {server.lastSeenAt
                  ? `${duration((Date.now() - new Date(server.lastSeenAt)) / 1000)} ago`
                  : "never"}
              </span>
            ) : (
              <>
                {server.appMemMb != null && `this site is using ${gb(server.appMemMb)}`}
                {/* about this process rather than the machine, which is why it
                    lives on the footer and not in the header beside uptime */}
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

/* ---------- services ----------
 * The applications, as opposed to the machines above.
 *
 * A separate card because it answers a separate question. Moontower says nginx
 * and docker are running, which is the plumbing; this says the site behind them
 * actually returns a page. The interesting outage is the one where every unit
 * on the box is green and the thing is still down, and only a real request over
 * the real network catches that.
 */
const Services = ({ data }) => {
  const list = data?.services ?? [];
  /* Three states, not two. A service whose last reading has gone stale is not
     up and it is not down: the probe loop stopped, and the honest thing is to
     say so rather than keep showing the number it left behind. */
  const unknown = list.filter((s) => s.ok === null || s.stale);
  const down = list.filter((s) => s.ok === false && !s.stale);
  const up = list.filter((s) => s.ok === true && !s.stale);
  // one number for the whole healthy set: the slowest is the only one that
  // would ever make me look, and an average would hide it
  const latencies = up.map((s) => s.latencyMs).filter((v) => typeof v === "number");
  const slowest = latencies.length ? Math.max(...latencies) : null;
  // everything that is not a problem, in one list: the card gives a row each
  // when there is room and collapses them to a line when there is not
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
          {/* Only what is broken gets a row of its own. Four green lines saying
              nothing is wrong is four lines of nothing, and it was costing this
              card an entire grid row it did not need. */}
          <ul className="svc">
            {down.map((s) => (
              <li key={s.slug} className="bad">
                <i className="d d-bad" />
                <span className="n">{s.name}</span>
                <span className="t">
                  {/* how long it has been broken beats the status code, which
                      is usually just 502 either way */}
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

          {/* The same healthy set as one line. Both are rendered and the fit
              tiers choose: with room a row each is more useful, and when the
              grid is under pressure four green rows are four rows of nothing. */}
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

/** Shared by the desktop grid and the mobile row, so they cannot drift apart. */
const useWidgetData = () => {
  const [github, setGithub] = useState(null);
  const [building, setBuilding] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      // nothing to refresh while the tab is in the background
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
        /* the cards keep their last good state rather than flashing an error */
      }
    };

    load();
    const timer = setInterval(load, POLL_MS);
    document.addEventListener("visibilitychange", load);
    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", load);
    };
  }, []);

  const authed = useAuthStore((s) => s.status === "authed");

  return { github, building, authed };
};

/**
 * Polls only while signed in and only while the tab is visible. The endpoint
 * 401s for everyone else, so polling it anonymously would be a request per
 * visitor per 30 seconds in exchange for nothing.
 */
const useSystemData = (enabled) => {
  const [system, setSystem] = useState(null);

  useEffect(() => {
    if (!enabled) {
      setSystem(null); // signing out must drop the numbers, not freeze them
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
        /* keep the last good reading rather than flashing an error */
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
 * The cards, in order, so both layouts render the same set. `wide` marks the
 * ones that need the full width on mobile: a heatmap and a commit message are
 * unreadable in a half-width tile, a clock is not.
 *
 * System is appended rather than inserted, so signing in adds a row underneath
 * instead of reshuffling the cards I already know the positions of.
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
      ]
    : []),
];

/* ---------- fitting above the dock ----------
 * The block hangs from a fixed offset under the nameplate and grows downwards;
 * the dock is pinned to the bottom. Nothing in CSS stops them meeting, and a
 * media query cannot tell them apart either, because how tall this gets is a
 * question about content: a live contributions heatmap is 31px that an empty
 * card does not spend, which is the whole margin at 1470x806.
 *
 * So measure. Try each tier in order and stop at the first that clears the
 * dock. Trying them in order is what keeps this from oscillating: the answer
 * depends only on the untightened layout, so re-running it lands on the same
 * tier rather than relaxing, colliding and tightening again.
 *
 * The last tier is the floor. If even that collides there is nothing further to
 * give, and running out of rungs has to leave the block at its smallest rather
 * than back at full size, so the loop falls through with `bare` still applied.
 */
const FIT_TIERS = ["", "tight", "compact", "min", "bare"];
const DOCK_CLEARANCE = 20;

/**
 * Mobile: a grid on the first springboard page. No dragging.
 *
 * `authed: false` is not a bug. A fifth card overflows this page by 111px, and
 * a springboard page that scrolls vertically stops feeling like a springboard,
 * so the system card gets a page of its own instead (see MobileSystem).
 */
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

/**
 * The signed-in springboard page. Alone on its page it has room for the stats
 * to be readable, which they were not squeezed under the other four cards.
 */
export const MobileSystem = () => {
  const authed = useAuthStore((s) => s.status === "authed");
  const system = useSystemData(authed);
  return (
    <div className="m-widgets">
      <div className="widget-slot wide">
        <System data={system} />
      </div>
      {/* both signed-in cards, since they answer the same question at two
          levels and this page has the room the desktop grid does not */}
      <div className="widget-slot wide">
        <Services data={system} />
      </div>
    </div>
  );
};

/**
 * Which grid a set of drag offsets was measured against. Bump GEOMETRY when the
 * block's own spacing changes, since offsets taken before it are then describing
 * a layout that no longer exists; the card list covers the rest, because signing
 * in adds a row and moves everything under it.
 */
const GEOMETRY = 2;
const signature = (list) => `${GEOMETRY}:${list.map((c) => c.id).join(",")}`;

/**
 * Restores a saved offset without letting it put a card somewhere unreachable.
 * The offset was taken in whatever window happened to be open at the time, so
 * reopening the site smaller can leave a card under the dock or off the edge.
 * Only on restore, not on drag: dragging is already bounded, and a card the
 * visitor deliberately parked somewhere should stay parked there.
 */
const restore = (el, pos, area) => {
  const base = el.getBoundingClientRect(); // untransformed: nothing set yet
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

  // same drag-and-persist contract as the desktop folders in Home.jsx
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

      // Clear first. React does not own these transforms, so a card that moved
      // under the previous layout would still be carrying that offset, and
      // restore would measure its home position from the wrong place.
      gsap.set(slots, { x: 0, y: 0 });

      const saved = useWindowStore.getState().widgetPos[layout] ?? {};
      slots.forEach((el) => {
        const p = saved[el.dataset.id];
        if (p) restore(el, p, area);
      });

      const instances = Draggable.create(slots, {
        // the element, not the selector: useGSAP's scope resolves selector
        // strings inside rootRef, where "main" does not exist
        bounds: main,
        onDragEnd() {
          setWidgetPos(layout, this.target.dataset.id, { x: this.x, y: this.y });
        },
      });
      return () => instances.forEach((i) => i.kill());
    },
    // re-run when the card set changes: the session resolves a moment after
    // mount, so a one-shot effect would leave that fifth card undraggable, and
    // the offsets it should be replaying change with it
    { scope: rootRef, dependencies: [layout] }
  );

  // Measured, not guessed: see FIT_TIERS. Re-run whenever anything that decides
  // a card's height lands, and on resize.
  useEffect(() => {
    const el = rootRef.current;
    const dock = document.querySelector("#dock");
    if (!el || !dock) return;

    const fit = () => {
      // fonts.ready can resolve after an unmount, and a detached node measures
      // as zero, which would read as "everything fits"
      if (!el.isConnected) return;
      for (const tier of FIT_TIERS) {
        el.dataset.fit = tier;
        // reading a rect flushes the pending style change, so every tier is
        // measured under its own rules rather than the previous tier's
        const clear = dock.getBoundingClientRect().top - el.getBoundingClientRect().bottom;
        if (clear >= DOCK_CLEARANCE) return;
      }
    };

    fit();
    // a late webfont reflows the cards after the first pass
    document.fonts?.ready.then(fit);
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [data.github, data.building, system, data.authed]);

  // "Clean Up" empties widgetPos: snap every card back to its home position
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
    // the fifth card has to come from somewhere: signing in slides the block
    // up towards the nameplate rather than down into the dock
    <section id="widgets" className={clsx(data.authed && "authed")} ref={rootRef}>
      {list.map(({ id, node, wide }) => (
        <div
          key={id}
          // The signed-in cards span the grid by default and pair up only
          // where there is width for it (see the min-width rule in the CSS).
          // At half of a narrow grid three stats do not fit on a line.
          className={clsx("widget-slot", (id === "system" || id === "services") && wide && "wide")}
          data-id={id}
        >
          {node}
        </div>
      ))}
    </section>
  );
};

export default Widgets;
