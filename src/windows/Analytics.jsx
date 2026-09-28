import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";
import WindowWrapper from "#hoc/WindowWrapper.jsx";
import { WindowControls } from "#components";
import useAuthStore from "#store/auth.js";
import useWindowStore from "#store/window.js";

const TABS = ["Overview", "Traffic", "Visits", "Heatmap"];
const RANGES = [7, 30, 90];

const get = async (path) => {
  const res = await fetch(path, { credentials: "same-origin" });
  if (!res.ok) throw new Error(String(res.status));
  return res.json();
};

const percent = (part, whole) => (whole ? Math.round((part / whole) * 100) : 0);

const spell = (ms) => {
  const seconds = Math.round((ms ?? 0) / 1000);
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, "0")}s`;
};

const when = (iso) => {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 60 * 24) return `${Math.round(minutes / 60)}h ago`;
  return `${Math.round(minutes / (60 * 24))}d ago`;
};

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
              <span className="an-bar" style={{ "--fill": `${(row.count / most) * 100}%` }} />
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

/** Clicks painted over the real desktop, since that is what they were aimed at. */
const Heatmap = ({ points }) => {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    const paint = () => {
      const width = (canvas.width = window.innerWidth);
      const height = (canvas.height = window.innerHeight);
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, width, height);

      for (const point of points) {
        const x = point.x * width;
        const y = point.y * height;
        const glow = ctx.createRadialGradient(x, y, 0, x, y, 30);
        glow.addColorStop(0, "rgba(255, 122, 45, 0.30)");
        glow.addColorStop(1, "rgba(255, 122, 45, 0)");
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(x, y, 30, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    paint();
    window.addEventListener("resize", paint);
    return () => window.removeEventListener("resize", paint);
  }, [points]);

  return createPortal(<canvas ref={ref} className="an-heatmap" aria-hidden="true" />, document.body);
};

const Analytics = () => {
  const isOpen = useWindowStore((state) => state.windows.analytics.isOpen);
  const authed = useAuthStore((state) => state.status === "authed");
  const [tab, setTab] = useState("Overview");
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const [overview, traffic, funnel, paths, visits, heatmap] = await Promise.all([
        get(`/api/tel/overview?days=${days}`),
        get(`/api/tel/traffic?days=${days}`),
        get(`/api/tel/funnel?days=${days}`),
        get(`/api/tel/paths?days=${days}`),
        get("/api/tel/sessions?limit=25"),
        get(`/api/tel/heatmap?days=${days}`),
      ]);
      setData({ overview, traffic, funnel, paths, visits: visits.sessions, heatmap: heatmap.points });
    } catch {
      setError("could not reach the server");
    }
  }, [days]);

  useEffect(() => {
    if (isOpen && authed) load();
  }, [isOpen, authed, load]);

  const busy = !data && !error;
  const { overview, traffic, funnel, paths } = data ?? {};

  return (
    <>
      <div id="window-header">
        <WindowControls target="analytics" />
        <h2>Analytics</h2>
      </div>

      <div className="an-toolbar">
        <div className="an-tabs">
          {TABS.map((name) => (
            <button
              key={name}
              type="button"
              className={clsx(name === tab && "on")}
              onClick={() => setTab(name)}
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
        {!authed && <p className="an-empty">Sign in from the terminal to read this.</p>}
        {authed && busy && <p className="an-empty">reading…</p>}
        {authed && error && <p className="an-empty">{error}</p>}

        {authed && data && tab === "Overview" && (
          <>
            <div className="an-figures">
              <Figure
                label="visits"
                value={overview.sessions}
                note={`${overview.visitors} people`}
              />
              <Figure
                label="time each"
                value={spell(overview.avg_duration_ms)}
                note={`${overview.events.toLocaleString()} events`}
              />
              <Figure
                label="left at once"
                value={`${percent(overview.bounced, overview.sessions)}%`}
                note={`${overview.bounced} visits`}
              />
              <Figure
                label="on a phone"
                value={`${percent(overview.on_phone, overview.sessions)}%`}
                note={`crawlers ${overview.bots}`}
              />
            </div>

            <section className="an-ranked">
              <p className="an-label">by day</p>
              <div className="an-days">
                {overview.daily.map((day) => {
                  const most = Math.max(1, ...overview.daily.map((d) => d.sessions));
                  return (
                    <span
                      key={day.day}
                      title={`${day.day}: ${day.sessions} visits`}
                      style={{ "--h": `${(day.sessions / most) * 100}%` }}
                    />
                  );
                })}
              </div>
            </section>

            <Ranked
              title="how far a visit gets"
              rows={[
                { key: "landed", count: funnel.landed },
                { key: "opened something", count: funnel.opened },
                { key: "opened a project", count: funnel.project },
                { key: "ran a command", count: funnel.terminal },
                { key: "clicked out", count: funnel.clicked },
                { key: "wrote a note", count: funnel.wrote },
              ]}
            />
          </>
        )}

        {authed && data && tab === "Traffic" && (
          <>
            <Ranked title="source" rows={traffic.sources} />
            <Ranked title="campaign" rows={traffic.campaigns} />
            <Ranked title="printed links" rows={traffic.refs} />
            <Ranked title="network" rows={traffic.orgs} />
            <Ranked title="country" rows={traffic.countries} />
            <Ranked title="opened first" rows={paths.first} />
            <Ranked title="and then" rows={paths.moves} />
          </>
        )}

        {authed && data && tab === "Visits" && (
          <ul className="an-visits">
            {data.visits.map((visit) => (
              <li key={visit.id}>
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
                    via {[visit.utm_source ?? visit.referrer_host, visit.utm_campaign, visit.ref]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                )}
                {visit.trail && <p className="an-trail">{visit.trail}</p>}
              </li>
            ))}
          </ul>
        )}

        {authed && data && tab === "Heatmap" && (
          <>
            <p className="an-note">
              {data.heatmap.length} clicks over the desktop, drawn where they landed. Move this
              window aside to see underneath it.
            </p>
            <Heatmap points={data.heatmap} />
          </>
        )}
      </div>
    </>
  );
};

export default WindowWrapper(Analytics, "analytics", { min: { w: 420, h: 340 } });
