import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { Draggable } from "gsap/Draggable";
import { useGSAP } from "@gsap/react";
import dayjs from "dayjs";
import useWindowStore from "#store/window.js";
import { Heatmap } from "./Sparkline.jsx";

gsap.registerPlugin(Draggable);

const POLL_MS = 15 * 60 * 1000; // GitHub is cached for 5 min server-side anyway

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
    <article className="widget w-clock">
      <header>
        <span>{asleep ? "🌙" : "☀️"}</span> Austin, TX
      </header>
      <p className="big">
        {get("hour")}:{get("minute")}
        <span className="unit">{get("dayPeriod")}</span>
      </p>
      <p className="sub">
        {weekday} · {asleep ? "probably asleep" : "probably around"}
      </p>
    </article>
  );
};

/* ---------- GitHub contributions ---------- */
const Contributions = ({ data }) => (
  <article className="widget w-contrib">
    <header>
      <span>▦</span> Contributions
    </header>
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
  <article className="widget w-commit">
    <header>
      <span>⚡</span> Latest commit
    </header>
    {data?.available ? (
      <>
        <p className="repo">{data.repo}</p>
        <p className="msg">{data.message}</p>
        <p className="sub">
          {data.sha} · {dayjs(data.at).format("MMM D, h:mm A")}
        </p>
      </>
    ) : (
      <p className="empty">No recent pushes.</p>
    )}
  </article>
);

/* ---------- now building ---------- */
const NowBuilding = ({ data }) => (
  <article className="widget w-building">
    <header>
      <span>🔨</span> Now building
    </header>
    {data?.text ? (
      <>
        <p className="msg">{data.text}</p>
        {data.updatedAt && (
          <p className="sub">updated {dayjs(data.updatedAt).format("MMM D")}</p>
        )}
      </>
    ) : (
      <p className="empty">Nothing set. Run `building &lt;text&gt;` in the terminal.</p>
    )}
  </article>
);

const Widgets = () => {
  const { widgetPos, setWidgetPos } = useWindowStore();
  const [github, setGithub] = useState(null);
  const [building, setBuilding] = useState(null);
  const rootRef = useRef(null);

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
    { scope: rootRef }
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
    <section id="widgets" ref={rootRef}>
      <div className="widget-slot" data-id="clock">
        <AustinClock />
      </div>
      <div className="widget-slot" data-id="contrib">
        <Contributions data={github?.contributions} />
      </div>
      <div className="widget-slot" data-id="commit">
        <LatestCommit data={github?.latest} />
      </div>
      <div className="widget-slot" data-id="building">
        <NowBuilding data={building} />
      </div>
    </section>
  );
};

export default Widgets;
