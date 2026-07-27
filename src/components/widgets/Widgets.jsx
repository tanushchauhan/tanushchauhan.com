import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { Draggable } from "gsap/Draggable";
import { useGSAP } from "@gsap/react";
import dayjs from "dayjs";
import clsx from "clsx";
import useWindowStore from "#store/window.js";
import useAuthStore from "#store/auth.js";
import { Heatmap, Sparkline } from "./Sparkline.jsx";
import { Sun, Moon, Grid3x3, GitCommitVertical, Box, Activity } from "lucide-react";

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

const Stat = ({ label, value, unit, values }) => (
  <div className="stat">
    <p className="k">{label}</p>
    <p className="v">
      {value}
      {unit && <span className="unit">{unit}</span>}
    </p>
    {/* stroke stays currentColor: a var() in an SVG presentation attribute is
        not reliably supported, so the CSS sets `color` on the svg instead */}
    <Sparkline values={values} height={22} />
  </div>
);

/*
 * Deliberately the shortest card here. It is a fifth card in a grid that was
 * already close to the dock, so the uptime and environment ride along in the
 * header instead of taking a footer line of their own.
 */
const System = ({ data }) => {
  const s = data?.sample;
  const history = data?.history ?? [];

  return (
    <article className="widget w-system" style={{ "--accent": "#5eb0ef" }}>
      <Head icon={<Activity />}>
        System
        {data && (
          <span className="tail">
            up {duration(data.uptimeSeconds)}
            {s && ` · ${s.cores} vCPU`}
            {` · ${data.env}`}
            {/* says which numbers these are: cgroup means this container's own
                limits, os means the whole host and the percentages are of a
                box I am sharing */}
            {s && ` · ${s.memSource}`}
          </span>
        )}
      </Head>
      {data ? (
        <div className="stats">
          <Stat
            label="CPU"
            // null until the sampler has two readings to compare
            value={s?.cpuPct ?? "—"}
            unit={s?.cpuPct == null ? "" : "%"}
            values={history.map((h) => h.cpuPct)}
          />
          <Stat
            label="Memory"
            value={s?.memUsedMb ?? "—"}
            unit={s ? ` / ${s.memTotalMb} MB` : ""}
            values={history.map((h) => h.memPct)}
          />
        </div>
      ) : (
        <p className="empty">Waiting for the first reading…</p>
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
        const res = await fetch("/api/widgets/system", {
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
  ...(authed ? [{ id: "system", wide: true, node: <System data={system} /> }] : []),
];

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
    </div>
  );
};

const Widgets = () => {
  const { widgetPos, setWidgetPos } = useWindowStore();
  const data = useWidgetData();
  const system = useSystemData(data.authed);
  const rootRef = useRef(null);

  // same drag-and-persist contract as the desktop folders in Home.jsx
  useGSAP(
    () => {
      const slots = rootRef.current?.querySelectorAll(".widget-slot");
      if (!slots?.length) return;

      const saved = useWindowStore.getState().widgetPos;
      slots.forEach((el) => {
        const p = saved[el.dataset.id];
        if (p) gsap.set(el, { x: p.x, y: p.y });
      });

      const instances = Draggable.create(slots, {
        // the element, not the selector: useGSAP's scope resolves selector
        // strings inside rootRef, where "main" does not exist
        bounds: rootRef.current?.closest("main"),
        onDragEnd() {
          setWidgetPos(this.target.dataset.id, { x: this.x, y: this.y });
        },
      });
      return () => instances.forEach((i) => i.kill());
    },
    // re-run when the system card appears: the session resolves a moment after
    // mount, so a one-shot effect would leave that fifth card undraggable
    { scope: rootRef, dependencies: [data.authed] }
  );

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
      {cards({ ...data, system }).map(({ id, node, wide }) => (
        <div
          key={id}
          // system spans both columns here too: two stats side by side need
          // the width, and a lone half-width card in a third row looks orphaned
          className={clsx("widget-slot", id === "system" && wide && "wide")}
          data-id={id}
        >
          {node}
        </div>
      ))}
    </section>
  );
};

export default Widgets;
