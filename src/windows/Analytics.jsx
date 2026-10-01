import { createContext, useContext, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ChevronLeft,
  ChevronRight,
  Compass,
  DoorOpen,
  Footprints,
  Globe,
  LayoutGrid,
  MousePointerClick,
  Pencil,
  Smartphone,
  Timer,
  Users,
  Zap,
} from "lucide-react";
import clsx from "clsx";
import dayjs from "dayjs";
import WindowWrapper from "#hoc/WindowWrapper.jsx";
import { WindowControls } from "#components";
import useAuthStore from "#store/auth.js";
import useWindowStore, { useAppState } from "#store/window.js";

const SECTIONS = [
  {
    name: "Reports",
    tabs: [
      { name: "Overview", icon: LayoutGrid },
      { name: "Traffic", icon: Compass },
      { name: "Events", icon: Zap },
      { name: "Heatmap", icon: MousePointerClick },
    ],
  },
  {
    name: "Visitors",
    tabs: [
      { name: "Visits", icon: Footprints },
      { name: "People", icon: Users },
    ],
  },
];
const TABS = SECTIONS.flatMap((section) => section.tabs.map((tab) => tab.name));
const RANGES = [7, 30, 90];
// "here now" also changes when someone leaves, which nothing announces
const LIVE_MS = 30000;
// the heavier reports are not worth refetching more often than this
const REFRESH_MS = 500;
const LABEL_MAX = 60;

const get = async (path) => {
  const res = await fetch(path, { credentials: "same-origin" });
  if (!res.ok) throw new Error(String(res.status));
  return res.json();
};

/** Goes up by one each time the server says something was recorded. */
const Changes = createContext(0);

/**
 * One report, fetched when its tab is on screen and dropped when it leaves. A
 * change refetches it in place, keeping the old numbers until the new ones land.
 */
const useReport = (path) => {
  const changes = useContext(Changes);
  const [state, setState] = useState({ path: null, data: null, error: "" });

  useEffect(() => {
    let alive = true;
    get(path)
      .then((data) => alive && setState({ path, data, error: "" }))
      .catch(
        () =>
          alive &&
          setState((last) =>
            last.path === path && last.data ? last : { path, data: null, error: "could not reach the server" }
          )
      );
    return () => {
      alive = false;
    };
  }, [path, changes]);

  return state.path === path ? state : { data: null, error: "" };
};

/**
 * Listens for recorded visits while the window is open. My own clicks count
 * only when my visits are shown, and changes that arrive while the window is
 * out of sight are caught up on when it comes back.
 */
const useChanges = (open, visible, me) => {
  const [count, setCount] = useState(0);
  const seen = useRef({ visible, me, missed: false });
  seen.current.visible = visible;
  seen.current.me = me;

  useEffect(() => {
    if (!open) return;
    let last = 0;
    let timer = null;

    const bump = () => {
      timer = null;
      if (!seen.current.visible || document.hidden) {
        seen.current.missed = true;
        return;
      }
      last = Date.now();
      setCount((n) => n + 1);
    };

    const source = new EventSource("/api/tel/stream");
    source.addEventListener("change", (event) => {
      let mine = false;
      try {
        mine = JSON.parse(event.data).mine === true;
      } catch {
        // a change we cannot read is still a change
      }
      if (mine && !seen.current.me) return;
      timer ??= setTimeout(bump, Math.max(0, last + REFRESH_MS - Date.now()));
    });

    const onVisible = () => {
      if (!document.hidden && seen.current.missed) {
        seen.current.missed = false;
        bump();
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      source.close();
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [open]);

  // restored from the dock
  useEffect(() => {
    if (visible && seen.current.missed) {
      seen.current.missed = false;
      setCount((n) => n + 1);
    }
  }, [visible]);

  return count;
};

/** Your own visits are left out of every report unless asked for. */
const scoped = (path, me) => (me ? `${path}${path.includes("?") ? "&" : "?"}me=1` : path);

const percent = (part, whole) => (whole ? Math.round((part / whole) * 100) : 0);

const spell = (ms) => {
  const seconds = Math.round((ms ?? 0) / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${String(seconds % 60).padStart(2, "0")}s`;
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, "0")}m`;
};

const when = (iso) => {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 60 * 24) return `${Math.round(minutes / 60)}h ago`;
  return `${Math.round(minutes / (60 * 24))}d ago`;
};

/** Minutes and seconds from the start of a visit, for the timeline. */
const offset = (at, from) => {
  const seconds = Math.max(0, Math.round((new Date(at) - new Date(from)) / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
};

const Waiting = ({ error }) => <p className="an-empty">{error || "reading…"}</p>;

/** A country code in a circle, or a globe when the address had none. */
const Badge = ({ country }) => (
  <span className="an-badge">{country ?? <Globe className="size-3.5" />}</span>
);

/**
 * What I have called a visitor, with a pencil to change it. The saved name
 * shows at once, before the refetch that follows catches up.
 */
const Name = ({ visitorId, label, fallback, className = "an-who" }) => {
  const [shown, setShown] = useState(label);
  const [draft, setDraft] = useState(null);
  useEffect(() => setShown(label), [label]);

  const save = async () => {
    if (draft === null) return;
    const next = draft.trim() || null;
    setDraft(null);
    if (next === (shown ?? null)) return;

    const before = shown;
    setShown(next);
    try {
      const res = await fetch(`/api/tel/people/${visitorId}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ label: next }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setShown((await res.json()).label);
    } catch {
      setShown(before);
    }
  };

  if (draft !== null) {
    return (
      <input
        className="an-label-input"
        value={draft}
        maxLength={LABEL_MAX}
        placeholder={fallback}
        aria-label="Name this visitor"
        autoFocus
        onChange={(e) => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") setDraft(null);
        }}
      />
    );
  }

  return (
    <>
      <span className={className}>{shown ?? fallback}</span>
      {visitorId != null && (
        <button
          type="button"
          className="an-rename"
          aria-label="Name this visitor"
          data-t="rename"
          onClick={() => setDraft(shown ?? "")}
        >
          <Pencil />
        </button>
      )}
    </>
  );
};

const Figure = ({ icon: Icon, accent, label, value, note }) => (
  <div className="an-figure" style={{ "--accent": accent }}>
    <p className="an-label">
      <span className="an-ico">
        <Icon />
      </span>
      {label}
    </p>
    <p className="an-value">{value}</p>
    {note && <p className="an-note">{note}</p>}
  </div>
);

/** Bars scaled to the top row. With `of`, each row also shows its share of that total. */
const Ranked = ({ title, rows, of }) => {
  const most = Math.max(1, ...(rows ?? []).map((r) => r.count));
  return (
    <section className="an-card">
      <p className="an-label">{title}</p>
      {rows?.length ? (
        <ul className="an-rows">
          {rows.map((row) => (
            <li key={row.key}>
              <span className="an-fill" style={{ "--fill": `${(row.count / (of || most)) * 100}%` }} />
              <span className="an-key">{row.key}</span>
              {of != null && <span className="an-share">{percent(row.count, of)}%</span>}
              <span className="an-count">{row.count.toLocaleString()}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="an-empty">nothing yet</p>
      )}
    </section>
  );
};

const Trail = ({ trail }) => (
  <p className="an-trail">
    {trail.split(" > ").map((step, i) => (
      <span key={i}>
        {i > 0 && <i>{" › "}</i>}
        {step}
      </span>
    ))}
  </p>
);

/* ---------------- tabs ---------------- */

const Daily = ({ daily }) => {
  const [hover, setHover] = useState(null);
  const most = Math.max(1, ...daily.map((d) => d.sessions));
  const total = daily.reduce((sum, d) => sum + d.sessions, 0);
  const day = hover == null ? null : daily[hover];

  return (
    <section className="an-card">
      <div className="an-card-head">
        <p className="an-label">by day</p>
        <p className="an-readout">
          {day
            ? `${dayjs(day.day).format("ddd, MMM D")} · ${day.sessions} visits, ${day.visitors} people`
            : `${(total / Math.max(1, daily.length)).toFixed(1)} a day · best ${most}`}
        </p>
      </div>
      <div className="an-days" onMouseLeave={() => setHover(null)}>
        {daily.map((d, i) => (
          <span
            key={d.day}
            className={clsx(i === hover && "on")}
            style={{ "--h": `${(d.sessions / most) * 100}%` }}
            onMouseEnter={() => setHover(i)}
          />
        ))}
      </div>
      {daily.length > 0 && (
        <div className="an-axis">
          <span>{dayjs(daily[0].day).format("MMM D")}</span>
          <span>{dayjs(daily.at(-1).day).format("MMM D")}</span>
        </div>
      )}
    </section>
  );
};

const Overview = ({ days, me }) => {
  const { data, error } = useReport(scoped(`/api/tel/overview?days=${days}`, me));
  const funnel = useReport(scoped(`/api/tel/funnel?days=${days}`, me));
  if (!data) return <Waiting error={error} />;

  return (
    <>
      <div className="an-figures">
        <Figure
          icon={Footprints}
          accent="#f08a2d"
          label="visits"
          value={data.sessions.toLocaleString()}
          note={
            data.mine
              ? `${data.visitors} people · ${data.mine} ${me ? "of them yours" : "of yours hidden"}`
              : `${data.visitors} people`
          }
        />
        <Figure
          icon={Timer}
          accent="#5eb0ef"
          label="time each"
          value={spell(data.avg_duration_ms)}
          note={`${data.events.toLocaleString()} events`}
        />
        <Figure
          icon={DoorOpen}
          accent="#a78bfa"
          label="left at once"
          value={`${percent(data.bounced, data.sessions)}%`}
          note={`${data.bounced} visits`}
        />
        <Figure
          icon={Smartphone}
          accent="#5fd39b"
          label="on a phone"
          value={`${percent(data.on_phone, data.sessions)}%`}
          note={`crawlers ${data.bots}`}
        />
      </div>

      <Daily daily={data.daily} />

      {funnel.data && (
        <Ranked
          title="how far a visit gets"
          of={funnel.data.landed}
          rows={[
            { key: "landed", count: funnel.data.landed },
            { key: "opened something", count: funnel.data.opened },
            { key: "opened a project", count: funnel.data.project },
            { key: "ran a command", count: funnel.data.terminal },
            { key: "clicked out", count: funnel.data.clicked },
            { key: "wrote a note", count: funnel.data.wrote },
          ]}
        />
      )}
    </>
  );
};

const Traffic = ({ days, me }) => {
  const { data, error } = useReport(scoped(`/api/tel/traffic?days=${days}`, me));
  const paths = useReport(scoped(`/api/tel/paths?days=${days}`, me));
  if (!data) return <Waiting error={error} />;

  return (
    <div className="an-grid">
      <Ranked title="source" rows={data.sources} />
      <Ranked title="campaign" rows={data.campaigns} />
      <Ranked title="printed links" rows={data.refs} />
      <Ranked title="network" rows={data.orgs} />
      <Ranked title="country" rows={data.countries} />
      <Ranked title="device" rows={data.devices} />
      <Ranked title="browser" rows={data.browsers} />
      <Ranked title="system" rows={data.systems} />
      {paths.data && (
        <>
          <Ranked title="opened first" rows={paths.data.first} />
          <Ranked title="and then" rows={paths.data.moves} />
        </>
      )}
    </div>
  );
};

/** Everything recorded about one visit, including every event in order. */
const Visit = ({ id }) => {
  const { data, error } = useReport(`/api/tel/visit/${id}`);
  if (!data) return <Waiting error={error} />;

  const { visit, events } = data;
  const facts = [
    [
      "came from",
      [visit.utm_source, visit.utm_medium, visit.utm_campaign, visit.ref].filter(Boolean).join(" · "),
    ],
    ["referrer", visit.referrer_host && `${visit.referrer_host}${visit.referrer_path ?? ""}`],
    ["landed on", visit.landing_path],
    ["network", visit.org ?? visit.rdns],
    ["country", visit.country],
    ["browser", [visit.browser, visit.browser_version, visit.os].filter(Boolean).join(" ")],
    [
      "screen",
      visit.viewport_w &&
        `${visit.viewport_w}x${visit.viewport_h} of ${visit.screen_w}x${visit.screen_h} at ${visit.dpr}x`,
    ],
    [
      "set to",
      [
        visit.timezone,
        visit.language,
        visit.prefers_dark ? "dark" : "light",
        visit.reduced_motion ? "less motion" : null,
      ]
        .filter(Boolean)
        .join(" · "),
    ],
  ].filter(([, value]) => value);

  return (
    <>
      <header className="an-hero">
        <Badge country={visit.country} />
        <div className="min-w-0">
          <h3 className="an-title">
            <Name
              visitorId={visit.visitor_id}
              label={visit.label}
              fallback={visit.org ?? visit.country ?? "unknown"}
              className="truncate"
            />
          </h3>
          <p className="an-note">
            {visit.visitor_id != null && `visitor #${visit.visitor_id} · `}
            {when(visit.started_at)} · stayed {spell(visit.duration_ms)} · {visit.events} events
            {visit.authed && " · signed in"}
          </p>
        </div>
      </header>

      <dl className="an-card an-facts">
        {facts.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>

      <section className="an-card">
        <p className="an-label">what happened</p>
        <ol className="an-timeline">
          {events.map((event) => (
            <li key={event.seq}>
              <span className="an-at">{offset(event.at, visit.started_at)}</span>
              <span className="an-name">{event.name}</span>
              <span className="an-key">{event.target ?? ""}</span>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
};

const Visits = ({ me, onOpen }) => {
  const { data, error } = useReport(scoped("/api/tel/sessions?limit=40", me));
  if (!data) return <Waiting error={error} />;
  if (!data.sessions.length) return <p className="an-empty">no visits yet</p>;

  return (
    <ul className="an-list an-visits">
      {data.sessions.map((visit) => (
        <li key={visit.id}>
          <button type="button" data-t="visit" onClick={() => onOpen(visit.id)}>
            <Badge country={visit.country} />
            <div className="an-row">
              <div className="an-visit-top">
                <span className="an-who">{visit.label ?? visit.org ?? visit.country ?? "unknown"}</span>
                {visit.visitor_visits > 1 && <span className="an-tag">visit {visit.visitor_visits}</span>}
                {visit.mine && <span className="an-tag">you</span>}
                <span className="an-when">{when(visit.started_at)}</span>
              </div>
              <p className="an-note">
                {[visit.label && visit.org, visit.browser, visit.os, visit.surface]
                  .filter(Boolean)
                  .join(" · ")}{" "}
                ·{" "}
                {spell(visit.duration_ms)} · {visit.events} events
              </p>
              {(visit.utm_source || visit.referrer_host || visit.ref) && (
                <p className="an-note">
                  via{" "}
                  {[visit.utm_source ?? visit.referrer_host, visit.utm_campaign, visit.ref]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              )}
              {visit.trail && <Trail trail={visit.trail} />}
            </div>
            <ChevronRight className="an-chevron" />
          </button>
        </li>
      ))}
    </ul>
  );
};

const People = ({ me }) => {
  const { data, error } = useReport(scoped("/api/tel/people?limit=60", me));
  if (!data) return <Waiting error={error} />;
  if (!data.people.length) return <p className="an-empty">nobody yet</p>;

  return (
    <ul className="an-list">
      {data.people.map((person) => (
        <li key={person.id} data-t="person">
          <Badge country={person.country} />
          <div className="an-row">
            <div className="an-visit-top">
              <Name
                visitorId={person.id}
                label={person.label}
                fallback={person.org ?? person.country ?? "unknown"}
              />
              <span className="an-tag">#{person.id}</span>
              {person.mine && <span className="an-tag">you</span>}
              <span className="an-when">{when(person.last_seen)}</span>
            </div>
            <p className="an-note">
              {person.visits} {person.visits === 1 ? "visit" : "visits"} · {person.events} events ·{" "}
              {spell(person.total_ms)} in total
            </p>
            <p className="an-note">
              {[
                person.label && person.org,
                [person.browser, person.os].filter(Boolean).join(" · "),
                `first seen ${when(person.first_seen)}`,
              ]
                .filter(Boolean)
                .join(" · ")}
              {person.found_by && ` via ${person.found_by}`}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
};

const Events = ({ days, me }) => {
  const { data, error } = useReport(scoped(`/api/tel/events?days=${days}`, me));
  if (!data) return <Waiting error={error} />;
  if (!data.events.length) return <p className="an-empty">nothing recorded yet</p>;

  const most = Math.max(1, ...data.events.map((e) => e.count));

  return (
    <section className="an-card">
      <p className="an-label">every event, most common first</p>
      <ul className="an-rows an-events">
        {data.events.map((event) => (
          <li key={`${event.name}:${event.target}`}>
            <span className="an-fill" style={{ "--fill": `${(event.count / most) * 100}%` }} />
            <span className="an-name">{event.name}</span>
            <span className="an-key">{event.target}</span>
            <span className="an-count">{event.count.toLocaleString()}</span>
            <span className="an-share">{event.sessions} visits</span>
          </li>
        ))}
      </ul>
    </section>
  );
};

/**
 * A click as a blob of heat. Drawing in `lighter` means two clicks in the same
 * place add up, which is the whole point of a heatmap.
 */
const paintHeat = (ctx, points, width, height) => {
  const radius = Math.max(12, Math.round(Math.min(width, height) / 22));
  ctx.globalCompositeOperation = "lighter";

  for (const point of points) {
    const x = point.x * width;
    const y = point.y * height;
    const glow = ctx.createRadialGradient(x, y, 0, x, y, radius);
    glow.addColorStop(0, "rgba(255, 150, 70, 0.9)");
    glow.addColorStop(0.4, "rgba(255, 110, 35, 0.4)");
    glow.addColorStop(1, "rgba(255, 90, 20, 0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalCompositeOperation = "source-over";
};

/** The menu bar and the dock, so a dot on the small map has something to sit against. */
const paintChrome = (ctx, width, height) => {
  ctx.fillStyle = "rgb(255 255 255 / 0.12)";
  ctx.fillRect(0, 0, width, height * 0.035);

  const dockWidth = width * 0.29;
  const dockHeight = height * 0.062;
  ctx.beginPath();
  ctx.roundRect((width - dockWidth) / 2, height - dockHeight * 1.5, dockWidth, dockHeight, dockHeight / 2);
  ctx.fill();
};

/** The desktop at a small size, over the current wallpaper, so nothing is hidden behind this window. */
const Minimap = ({ points }) => {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    const paint = () => {
      const box = canvas.getBoundingClientRect();
      if (!box.width) return;
      const width = (canvas.width = Math.round(box.width));
      const height = (canvas.height = Math.round(box.height));
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, width, height);
      paintChrome(ctx, width, height);
      paintHeat(ctx, points, width, height);
    };

    paint();
    const observer = new ResizeObserver(paint);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [points]);

  return (
    <canvas
      ref={ref}
      className="an-map"
      style={{ aspectRatio: `${window.innerWidth} / ${window.innerHeight}` }}
    />
  );
};

/** The same clicks at full size, over the desktop they were aimed at. */
const Overlay = ({ points }) => {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    const paint = () => {
      const width = (canvas.width = window.innerWidth);
      const height = (canvas.height = window.innerHeight);
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, width, height);
      paintHeat(ctx, points, width, height);
    };

    paint();
    window.addEventListener("resize", paint);
    return () => window.removeEventListener("resize", paint);
  }, [points]);

  return createPortal(<canvas ref={ref} className="an-heatmap" aria-hidden="true" />, document.body);
};

const Heatmap = ({ days, me }) => {
  const { data, error } = useReport(scoped(`/api/tel/heatmap?days=${days}`, me));
  const [over, setOver] = useState(false);
  if (!data) return <Waiting error={error} />;

  const counts = new Map();
  for (const point of data.points) {
    const key = point.target || "somewhere else";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const targets = [...counts]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  return (
    <>
      <section className="an-card">
        <div className="an-card-head">
          <p className="an-who">{data.points.length.toLocaleString()} clicks</p>
          <button
            type="button"
            role="switch"
            aria-checked={over}
            className="an-toggle"
            onClick={() => setOver(!over)}
          >
            show over the desktop
            <span className={clsx("cc-switch", over && "on")}>
              <span />
            </span>
          </button>
        </div>
        <Minimap points={data.points} />
      </section>

      <Ranked title="most clicked" rows={targets} of={data.points.length} />

      {over && <Overlay points={data.points} />}
    </>
  );
};

/* ---------------- the window ---------------- */

const Live = ({ me }) => {
  const changes = useContext(Changes);
  const [here, setHere] = useState([]);

  useEffect(() => {
    let alive = true;
    const tick = () =>
      get(scoped("/api/tel/live", me))
        .then((data) => alive && setHere(data.here))
        .catch(() => null);

    tick();
    const timer = setInterval(tick, LIVE_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [me, changes]);

  const doing = [
    ...new Set(
      here
        .filter((visit) => visit.doing)
        .map((visit) => (visit.label ? `${visit.label}: ${visit.doing}` : visit.doing))
    ),
  ].slice(0, 3);

  return (
    <div className={clsx("an-live", here.length && "on")}>
      <p>
        <i /> {here.length ? `${here.length} here now` : "nobody here now"}
      </p>
      {doing.length > 0 && <p className="an-doing">{doing.join(", ")}</p>}
    </div>
  );
};

const Analytics = () => {
  const isOpen = useWindowStore((state) => state.windows.analytics.isOpen);
  const isMinimized = useWindowStore((state) => state.windows.analytics.isMinimized);
  const signedIn = useAuthStore((state) => state.status === "authed");
  const [savedTab, setTab] = useAppState("analytics", "tab", "Overview");
  const [savedDays, setDays] = useAppState("analytics", "days", 30);
  const [me, setMe] = useAppState("analytics", "me", false);
  const [visitId, setVisitId] = useAppState("analytics", "visit", null);
  const [scroll, setScroll] = useAppState("analytics", "scroll", 0);
  const tab = TABS.includes(savedTab) ? savedTab : "Overview";
  const days = RANGES.includes(savedDays) ? savedDays : 30;
  const ready = isOpen && signedIn;
  const changes = useChanges(ready, !isMinimized, me);
  const bodyRef = useRef(null);

  // each report starts at the top, not wherever the last one was scrolled to
  const opened = useRef(false);
  useEffect(() => {
    if (opened.current) bodyRef.current?.scrollTo(0, 0);
  }, [tab, visitId]);

  // after a reload, back to where the list was once it is long enough to get there
  useEffect(() => {
    const body = bodyRef.current;
    if (!ready || !body || opened.current) return;
    opened.current = true;
    if (!scroll) return;

    const restore = () => {
      if (body.scrollHeight - body.clientHeight < scroll) return false;
      body.scrollTop = scroll;
      return true;
    };
    if (restore()) return;

    // wait for the report to render, and let a scroll by hand win
    let giveUp = null;
    const watcher = new MutationObserver(() => restore() && stop());
    const stop = () => {
      watcher.disconnect();
      body.removeEventListener("wheel", stop);
      clearTimeout(giveUp);
    };
    watcher.observe(body, { childList: true, subtree: true });
    body.addEventListener("wheel", stop, { passive: true });
    giveUp = setTimeout(stop, 5000);
    return stop;
  }, [ready]);

  const saveScroll = useRef(null);
  const onScroll = (e) => {
    const top = Math.round(e.currentTarget.scrollTop);
    clearTimeout(saveScroll.current);
    saveScroll.current = setTimeout(() => setScroll(top), 250);
  };

  const show = (name) => {
    setVisitId(null);
    setTab(name);
  };

  if (!isOpen || !signedIn) {
    return (
      <>
        <div id="window-header">
          <WindowControls target="analytics" />
          <h2>Analytics</h2>
        </div>
        <div className="an-body">
          <p className="an-empty">Sign in from the terminal to read this.</p>
        </div>
      </>
    );
  }

  // the range only changes reports that cover a stretch of days
  const ranged = !visitId && !["Visits", "People"].includes(tab);

  return (
    <>
      <div id="window-header">
        <WindowControls target="analytics" />
        <div className="finder-nav">
          <button
            type="button"
            className="an-back"
            aria-label="Back to visits"
            disabled={!visitId}
            onClick={() => setVisitId(null)}
          >
            <ChevronLeft />
          </button>
        </div>
        <h2>{visitId ? "Visit" : tab}</h2>
        <div className={clsx("an-range", !ranged && "idle")}>
          {RANGES.map((range) => (
            <button
              key={range}
              type="button"
              className={clsx(range === days && "on")}
              onClick={() => setDays(range)}
            >
              {range}d
            </button>
          ))}
        </div>
      </div>

      <Changes.Provider value={changes}>
        <div className="an-frame">
          <div className="sidebar an-tabs">
            {SECTIONS.map((section) => (
              <div key={section.name}>
                <h3>{section.name}</h3>
                {section.tabs.map(({ name, icon: Icon }) => (
                  <button
                    key={name}
                    type="button"
                    className={clsx(name === tab && "on")}
                    onClick={() => show(name)}
                  >
                    <Icon />
                    {name}
                  </button>
                ))}
              </div>
            ))}
            <button
              type="button"
              role="switch"
              aria-checked={me}
              className="an-me"
              onClick={() => setMe(!me)}
            >
              include my visits
              <span className={clsx("cc-switch", me && "on")}>
                <span />
              </span>
            </button>
            <Live me={me} />
          </div>

          <div className="an-body" ref={bodyRef} onScroll={onScroll}>
            {visitId ? (
              <Visit id={visitId} />
            ) : (
              <>
                {tab === "Overview" && <Overview days={days} me={me} />}
                {tab === "Traffic" && <Traffic days={days} me={me} />}
                {tab === "Visits" && <Visits me={me} onOpen={setVisitId} />}
                {tab === "People" && <People me={me} />}
                {tab === "Events" && <Events days={days} me={me} />}
                {tab === "Heatmap" && <Heatmap days={days} me={me} />}
              </>
            )}
          </div>
        </div>
      </Changes.Provider>
    </>
  );
};

export default WindowWrapper(Analytics, "analytics", { min: { w: 580, h: 380 } });
