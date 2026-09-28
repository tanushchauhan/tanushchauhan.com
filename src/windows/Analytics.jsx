import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft } from "lucide-react";
import clsx from "clsx";
import WindowWrapper from "#hoc/WindowWrapper.jsx";
import { WindowControls } from "#components";
import useAuthStore from "#store/auth.js";
import useWindowStore from "#store/window.js";

const TABS = ["Overview", "Traffic", "Visits", "People", "Events", "Heatmap"];
const RANGES = [7, 30, 90];
const LIVE_MS = 20000;

const get = async (path) => {
  const res = await fetch(path, { credentials: "same-origin" });
  if (!res.ok) throw new Error(String(res.status));
  return res.json();
};

/** One report, fetched when its tab is on screen and dropped when it leaves. */
const useReport = (path) => {
  const [state, setState] = useState({ data: null, error: "" });

  useEffect(() => {
    let alive = true;
    setState({ data: null, error: "" });
    get(path)
      .then((data) => alive && setState({ data, error: "" }))
      .catch(() => alive && setState({ data: null, error: "could not reach the server" }));
    return () => {
      alive = false;
    };
  }, [path]);

  return state;
};

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

const Figure = ({ label, value, note }) => (
  <div className="an-figure">
    <p className="an-label">{label}</p>
    <p className="an-value">{value}</p>
    {note && <p className="an-note">{note}</p>}
  </div>
);

const Ranked = ({ title, rows }) => {
  const most = Math.max(1, ...(rows ?? []).map((r) => r.count));
  return (
    <section className="an-ranked">
      <p className="an-label">{title}</p>
      {rows?.length ? (
        <ul>
          {rows.map((row) => (
            <li key={row.key}>
              <span className="an-fill" style={{ "--fill": `${(row.count / most) * 100}%` }} />
              <span className="an-key">{row.key}</span>
              <span className="an-count">{row.count}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="an-empty">nothing yet</p>
      )}
    </section>
  );
};

/* ---------------- tabs ---------------- */

const Overview = ({ days }) => {
  const { data, error } = useReport(`/api/tel/overview?days=${days}`);
  const funnel = useReport(`/api/tel/funnel?days=${days}`);
  if (!data) return <Waiting error={error} />;

  const most = Math.max(1, ...data.daily.map((d) => d.sessions));

  return (
    <>
      <div className="an-figures">
        <Figure label="visits" value={data.sessions} note={`${data.visitors} people`} />
        <Figure
          label="time each"
          value={spell(data.avg_duration_ms)}
          note={`${data.events.toLocaleString()} events`}
        />
        <Figure
          label="left at once"
          value={`${percent(data.bounced, data.sessions)}%`}
          note={`${data.bounced} visits`}
        />
        <Figure
          label="on a phone"
          value={`${percent(data.on_phone, data.sessions)}%`}
          note={`crawlers ${data.bots}`}
        />
      </div>

      <section className="an-ranked">
        <p className="an-label">by day</p>
        <div className="an-days">
          {data.daily.map((day) => (
            <span
              key={day.day}
              title={`${day.day}: ${day.sessions} visits, ${day.visitors} people`}
              style={{ "--h": `${(day.sessions / most) * 100}%` }}
            />
          ))}
        </div>
      </section>

      {funnel.data && (
        <Ranked
          title="how far a visit gets"
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

const Traffic = ({ days }) => {
  const { data, error } = useReport(`/api/tel/traffic?days=${days}`);
  const paths = useReport(`/api/tel/paths?days=${days}`);
  if (!data) return <Waiting error={error} />;

  return (
    <>
      <Ranked title="source" rows={data.sources} />
      <Ranked title="campaign" rows={data.campaigns} />
      <Ranked title="printed links" rows={data.refs} />
      <Ranked title="network" rows={data.orgs} />
      <Ranked title="country" rows={data.countries} />
      <Ranked title="browser" rows={data.browsers} />
      <Ranked title="device" rows={data.devices} />
      {paths.data && (
        <>
          <Ranked title="opened first" rows={paths.data.first} />
          <Ranked title="and then" rows={paths.data.moves} />
        </>
      )}
    </>
  );
};

/** Everything recorded about one visit, including every event in order. */
const Visit = ({ id, onBack }) => {
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
    ["stayed", `${spell(visit.duration_ms)} · ${visit.events} events`],
  ].filter(([, value]) => value);

  return (
    <>
      <button type="button" className="an-back" onClick={onBack}>
        <ChevronLeft className="size-4" /> visits
      </button>

      <h3 className="an-title">
        {visit.org ?? visit.country ?? "unknown"}
        <span className="an-when">{when(visit.started_at)}</span>
      </h3>

      <dl className="an-facts">
        {facts.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>

      <section className="an-ranked">
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

const Visits = ({ onOpen }) => {
  const { data, error } = useReport("/api/tel/sessions?limit=40");
  if (!data) return <Waiting error={error} />;
  if (!data.sessions.length) return <p className="an-empty">no visits yet</p>;

  return (
    <ul className="an-visits">
      {data.sessions.map((visit) => (
        <li key={visit.id}>
          <button type="button" onClick={() => onOpen(visit.id)}>
            <div className="an-visit-top">
              <span className="an-who">
                {visit.org ?? visit.country ?? "unknown"}
                {visit.visitor_visits > 1 && ` · visit ${visit.visitor_visits}`}
              </span>
              <span className="an-when">{when(visit.started_at)}</span>
            </div>
            <p className="an-note">
              {[visit.browser, visit.os, visit.surface].filter(Boolean).join(" · ")} ·{" "}
              {spell(visit.duration_ms)} · {visit.events} events
              {visit.authed && " · signed in"}
            </p>
            {(visit.utm_source || visit.referrer_host || visit.ref) && (
              <p className="an-note">
                via{" "}
                {[visit.utm_source ?? visit.referrer_host, visit.utm_campaign, visit.ref]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            )}
            {visit.trail && <p className="an-trail">{visit.trail}</p>}
          </button>
        </li>
      ))}
    </ul>
  );
};

const People = () => {
  const { data, error } = useReport("/api/tel/people?limit=60");
  if (!data) return <Waiting error={error} />;
  if (!data.people.length) return <p className="an-empty">nobody yet</p>;

  return (
    <ul className="an-visits">
      {data.people.map((person) => (
        <li key={person.id}>
          <div className="an-visit-top">
            <span className="an-who">
              #{person.id} · {person.org ?? person.country ?? "unknown"}
            </span>
            <span className="an-when">{when(person.last_seen)}</span>
          </div>
          <p className="an-note">
            {person.visits} {person.visits === 1 ? "visit" : "visits"} · {person.events} events ·{" "}
            {spell(person.total_ms)} in total
          </p>
          <p className="an-note">
            {[person.browser, person.os].filter(Boolean).join(" · ")} · first seen{" "}
            {when(person.first_seen)}
            {person.found_by && ` via ${person.found_by}`}
          </p>
        </li>
      ))}
    </ul>
  );
};

const Events = ({ days }) => {
  const { data, error } = useReport(`/api/tel/events?days=${days}`);
  if (!data) return <Waiting error={error} />;

  return (
    <section className="an-ranked">
      <p className="an-label">every event, most common first</p>
      <ul className="an-events">
        {data.events.map((event) => (
          <li key={`${event.name}:${event.target}`}>
            <span className="an-name">{event.name}</span>
            <span className="an-key">{event.target}</span>
            <span className="an-count">{event.count}</span>
            <span className="an-note">{event.sessions} visits</span>
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
  ctx.fillStyle = "rgb(255 255 255 / 0.07)";
  ctx.fillRect(0, 0, width, height * 0.035);

  const dockWidth = width * 0.29;
  const dockHeight = height * 0.062;
  ctx.beginPath();
  ctx.roundRect((width - dockWidth) / 2, height - dockHeight * 1.5, dockWidth, dockHeight, dockHeight / 2);
  ctx.fill();
};

/** The desktop at a small size, so nothing is hidden behind this window. */
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

const Heatmap = ({ days }) => {
  const { data, error } = useReport(`/api/tel/heatmap?days=${days}`);
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
      <div className="an-visit-top">
        <span className="an-who">{data.points.length} clicks</span>
        <button type="button" className={clsx("an-toggle", over && "on")} onClick={() => setOver(!over)}>
          {over ? "hide from the desktop" : "show over the desktop"}
        </button>
      </div>

      <Minimap points={data.points} />
      <Ranked title="most clicked" rows={targets} />

      {over && <Overlay points={data.points} />}
    </>
  );
};

/* ---------------- the window ---------------- */

const Live = () => {
  const [here, setHere] = useState(0);

  useEffect(() => {
    let alive = true;
    const tick = () =>
      get("/api/tel/live")
        .then((data) => alive && setHere(data.here.length))
        .catch(() => null);

    tick();
    const timer = setInterval(tick, LIVE_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  if (!here) return null;
  return (
    <span className="an-live">
      <i /> {here} here now
    </span>
  );
};

const Analytics = () => {
  const isOpen = useWindowStore((state) => state.windows.analytics.isOpen);
  const signedIn = useAuthStore((state) => state.status === "authed");
  const [tab, setTab] = useState("Overview");
  const [days, setDays] = useState(30);
  const [visitId, setVisitId] = useState(null);

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

  return (
    <>
      <div id="window-header">
        <WindowControls target="analytics" />
        <h2>Analytics</h2>
        <Live />
      </div>

      <div className="an-toolbar">
        <div className="an-tabs">
          {TABS.map((name) => (
            <button
              key={name}
              type="button"
              className={clsx(name === tab && "on")}
              onClick={() => show(name)}
            >
              {name}
            </button>
          ))}
        </div>
        <div className="an-range">
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

      <div className="an-body">
        {visitId ? (
          <Visit id={visitId} onBack={() => setVisitId(null)} />
        ) : (
          <>
            {tab === "Overview" && <Overview days={days} />}
            {tab === "Traffic" && <Traffic days={days} />}
            {tab === "Visits" && <Visits onOpen={setVisitId} />}
            {tab === "People" && <People />}
            {tab === "Events" && <Events days={days} />}
            {tab === "Heatmap" && <Heatmap days={days} />}
          </>
        )}
      </div>
    </>
  );
};

export default WindowWrapper(Analytics, "analytics", { min: { w: 460, h: 360 } });
