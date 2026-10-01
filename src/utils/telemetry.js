/**
 * Visit telemetry. Events are queued and sent in batches with sendBeacon, so a
 * closed tab still reports and a click never costs a request.
 *
 * One session is one tab: the id lives in sessionStorage, so a reload carries
 * on where it left off. Nothing is written to a cookie or to localStorage.
 */
const ENDPOINT = "/api/tel";
const STORE_KEY = "tanushos-tel";
const FLUSH_MS = 2000;
const QUEUE_MAX = 40;
const ERRORS_MAX = 5;
const CLICKS_MAX = 300;

// the tags a link can carry, and the short names they travel under
const CAMPAIGN = {
  utm_source: "us",
  utm_medium: "um",
  utm_campaign: "uc",
  utm_term: "ut",
  utm_content: "uo",
};

let session = null;
let queue = [];
let pendingContext = null;
let seq = 0;
let errors = 0;
let timer = null;

const now = () => Date.now();

/** A new id per tab, kept across reloads of that tab. */
const openSession = () => {
  try {
    const saved = JSON.parse(sessionStorage.getItem(STORE_KEY) ?? "null");
    if (saved?.id && saved?.t0) return { ...saved, fresh: false };
  } catch {
    // private mode, or a value someone else wrote
  }

  const started = { id: crypto.randomUUID(), t0: now() };
  try {
    sessionStorage.setItem(STORE_KEY, JSON.stringify(started));
  } catch {
    // without storage the session lasts until the page unloads, which is fine
  }
  return { ...started, fresh: true };
};

const referrer = () => {
  try {
    const url = new URL(document.referrer);
    if (url.host === location.host) return {};
    return { rh: url.host, rp: url.pathname };
  } catch {
    return {};
  }
};

const context = (surface) => {
  const params = new URLSearchParams(location.search);
  const tags = Object.fromEntries(
    Object.entries(CAMPAIGN).map(([param, key]) => [key, params.get(param)])
  );

  return {
    ...referrer(),
    ...tags,
    ref: params.get("ref") ?? params.get("via"),
    cid: params.get("gclid") ?? params.get("fbclid"),
    path: location.pathname,
    sf: surface,
    vw: window.innerWidth,
    vh: window.innerHeight,
    sw: window.screen?.width ?? null,
    sh: window.screen?.height ?? null,
    dpr: window.devicePixelRatio ?? null,
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
    lang: navigator.language,
    dark: window.matchMedia("(prefers-color-scheme: dark)").matches,
    rm: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  };
};

/** The tags belong in the database, not in the address bar for the rest of the visit. */
const cleanUrl = () => {
  const params = new URLSearchParams(location.search);
  const drop = [...Object.keys(CAMPAIGN), "ref", "via", "gclid", "fbclid"];
  if (!drop.some((key) => params.has(key))) return;

  drop.forEach((key) => params.delete(key));
  const query = params.toString();
  history.replaceState(null, "", location.pathname + (query ? `?${query}` : "") + location.hash);
};

const send = () => {
  if (!session || (!queue.length && !pendingContext)) return;

  const body = JSON.stringify({
    sid: session.id,
    ...(pendingContext ? { ctx: pendingContext } : {}),
    events: queue,
  });
  queue = [];
  pendingContext = null;

  try {
    const blob = new Blob([body], { type: "application/json" });
    if (navigator.sendBeacon?.(ENDPOINT, blob)) return;
  } catch {
    // over the beacon size limit, or the API is blocked
  }

  fetch(ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "same-origin",
    keepalive: true,
    body,
  }).catch(() => null);
};

const flushSoon = () => {
  if (timer) return;
  timer = setTimeout(() => {
    timer = null;
    send();
  }, FLUSH_MS);
};

const flushNow = () => {
  clearTimeout(timer);
  timer = null;
  send();
};

/**
 * Record something. `target` is what it happened to, `props` anything else
 * worth keeping, `point` a click position as a fraction of the viewport.
 */
export const track = (name, target = null, props = null, point = null) => {
  if (!session) return;

  queue.push({
    n: name,
    t: target,
    p: props,
    x: point?.x ?? null,
    y: point?.y ?? null,
    ms: now() - session.t0,
    s: seq++,
  });

  if (queue.length >= QUEUE_MAX) flushNow();
  else flushSoon();
};

/** What to call the thing that was clicked, best name first. */
const describe = (el) => {
  const tagged = el.closest("[data-t]");
  if (tagged) return tagged.dataset.t;

  const control = el.closest("button, a, [role='button'], input, summary, li");
  if (!control) return null;

  // every one of these is "" when absent, so fall through on empty, not just null
  const label =
    control.getAttribute("aria-label") ||
    control.getAttribute("title") ||
    control.id ||
    control.textContent;

  const name = (label ?? "").replace(/\s+/g, " ").trim().slice(0, 60);
  return name || control.tagName.toLowerCase();
};

/**
 * Every click reports itself, so a new control needs no wiring. Links that
 * leave the site are the interesting ones and get their own name.
 */
const watchClicks = () => {
  let clicks = 0;

  document.addEventListener(
    "click",
    (event) => {
      const el = event.target;
      if (!el?.closest || clicks >= CLICKS_MAX) return;
      clicks += 1;

      const point = {
        x: event.clientX / window.innerWidth,
        y: event.clientY / window.innerHeight,
      };

      const link = el.closest("a[href]");
      const href = link?.getAttribute("href") ?? "";
      if (href.startsWith("mailto:")) return track("link_click", "email", null, point);

      if (link) {
        try {
          const url = new URL(link.href, location.href);
          if (url.host && url.host !== location.host) {
            return track("link_click", url.host, { path: url.pathname.slice(0, 80) }, point);
          }
        } catch {
          // a href the URL parser will not take, such as a bare fragment
        }
      }

      const target = describe(el);
      if (target) track("click", target, null, point);
    },
    { capture: true, passive: true }
  );
};

const watchErrors = () => {
  const record = (message, source) => {
    if (errors >= ERRORS_MAX) return;
    errors += 1;
    track("js_error", source, { message: String(message ?? "").slice(0, 200) });
  };

  window.addEventListener("error", (event) => {
    const file = event.filename ? event.filename.split("/").pop() : null;
    record(event.message, file ? `${file}:${event.lineno}` : null);
  });
  window.addEventListener("unhandledrejection", (event) =>
    record(event.reason?.message ?? event.reason, "promise")
  );
};

/** Paint and layout figures, reported once when the tab first goes away. */
const watchVitals = () => {
  let lcp = 0;
  let shift = 0;

  const observe = (type, handle) => {
    try {
      new PerformanceObserver(handle).observe({ type, buffered: true });
    } catch {
      // the browser does not report this one
    }
  };

  observe("largest-contentful-paint", (list) => {
    const entry = list.getEntries().at(-1);
    if (entry) lcp = Math.round(entry.startTime);
  });
  observe("layout-shift", (list) => {
    for (const entry of list.getEntries()) if (!entry.hadRecentInput) shift += entry.value;
  });

  return () => {
    const [nav] = performance.getEntriesByType("navigation");
    track("web_vitals", null, {
      lcp,
      cls: Math.round(shift * 1000) / 1000,
      ttfb: nav ? Math.round(nav.responseStart) : 0,
      ready: nav ? Math.round(nav.domContentLoadedEventEnd) : 0,
    });
  };
};

let started = false;

export const startTelemetry = (surface) => {
  // a driven browser is not a visitor, and its beacons are not worth counting
  if (started || navigator.webdriver) return;
  started = true;

  session = openSession();
  if (session.fresh) {
    pendingContext = context(surface);
    cleanUrl();
    track("session_start", surface);
  }

  watchClicks();
  watchErrors();
  const reportVitals = watchVitals();

  let reported = false;
  const leaving = () => {
    if (document.visibilityState !== "hidden") return;
    if (!reported) {
      reported = true;
      reportVitals();
    }
    flushNow();
  };

  document.addEventListener("visibilitychange", leaving);
  window.addEventListener("pagehide", flushNow);
};
