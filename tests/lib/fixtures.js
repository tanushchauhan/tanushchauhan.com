/** Canned API responses, shaped like production, so layout tests see real card heights. */

const days = () => {
  const out = [];
  const start = new Date("2026-01-01T00:00:00");
  for (let i = 0; i < 208; i++) {
    const d = new Date(start.getTime() + i * 86400000);
    out.push({
      date: d.toISOString().slice(0, 10),
      count: i % 7 === 0 ? 6 : i % 3 === 0 ? 2 : 0,
    });
  }
  return out;
};

export const github = {
  contributions: { available: true, total: 192, private: 0, days: days() },
  latest: {
    available: true,
    repo: "Shoo",
    message: "edit readme",
    sha: "a6662cf",
    url: "https://github.com/tanushchauhan/Shoo",
    at: "2026-04-26T00:00:00Z",
  },
};

const top = (pairs) => pairs.map(([key, count]) => ({ key, count }));

export const tel = {
  overview: {
    days: 30, sessions: 260, visitors: 190, events: 2140, avg_duration_ms: 96000,
    bounced: 61, signed_in: 0, mine: 12, on_phone: 88, bots: 47,
    daily: Array.from({ length: 30 }, (_, i) => ({
      day: new Date(Date.now() - (29 - i) * 86400000).toISOString().slice(0, 10),
      sessions: 4 + ((i * 7) % 11),
      visitors: 3 + ((i * 5) % 8),
    })),
  },
  traffic: {
    days: 30,
    sources: top([["linkedin", 88], ["direct", 71], ["github.com", 40]]),
    referrers: top([["linkedin.com", 88], ["github.com", 40]]),
    campaigns: top([["resume-2026", 31]]),
    refs: top([["resume", 22], ["card", 5]]),
    countries: top([["US", 180], ["IN", 30], ["DE", 12]]),
    orgs: top([["utexas.edu", 24], ["comcast.net", 19]]),
    browsers: top([["Chrome", 140], ["Safari", 90]]),
    systems: top([["macOS", 120], ["iOS", 70]]),
    devices: top([["desktop", 172], ["phone", 88]]),
  },
  sessions: {
    sessions: [
      {
        id: "0f5f2f4e-0000-4000-8000-000000000001", visitor_id: 1204,
        started_at: new Date(Date.now() - 20 * 60000).toISOString(),
        duration_ms: 142000, events: 18, country: "US", org: "utexas.edu", rdns: null,
        browser: "Chrome", os: "macOS", device: "desktop", surface: "desktop",
        referrer_host: "linkedin.com", utm_source: "linkedin", utm_campaign: "resume-2026",
        ref: "resume", authed: false, mine: false, visitor_visits: 3,
        trail: "finder > crave > terminal > github.com",
      },
    ],
  },
  funnel: { days: 30, landed: 260, opened: 188, project: 96, terminal: 41, clicked: 33, wrote: 6 },
  paths: {
    days: 30,
    first: top([["finder", 96], ["terminal", 44]]),
    moves: top([["finder > photos", 21], ["terminal > finder", 14]]),
  },
  events: {
    days: 30,
    events: [
      { name: "click", target: "Projects", count: 210, sessions: 140 },
      { name: "window_open", target: "finder", count: 188, sessions: 132 },
      { name: "project_open", target: "crave", count: 96, sessions: 71 },
      { name: "terminal_command", target: "neofetch", count: 44, sessions: 38 },
      { name: "link_click", target: "github.com", count: 33, sessions: 29 },
      { name: "appearance", target: "theme", count: 18, sessions: 16 },
      { name: "guestbook_post", target: "", count: 6, sessions: 6 },
    ],
  },
  people: {
    people: [
      {
        id: 1204, visits: 3, sessions: 3, events: 42, total_ms: 380000, mine: false,
        first_seen: new Date(Date.now() - 9 * 86400000).toISOString(),
        last_seen: new Date(Date.now() - 20 * 60000).toISOString(),
        country: "US", org: "utexas.edu", browser: "Chrome", os: "macOS", found_by: "linkedin",
      },
      {
        id: 1203, visits: 1, sessions: 1, events: 4, total_ms: 22000, mine: false,
        first_seen: new Date(Date.now() - 3 * 86400000).toISOString(),
        last_seen: new Date(Date.now() - 3 * 86400000).toISOString(),
        country: "DE", org: null, browser: "Firefox", os: "Linux", found_by: "github.com",
      },
    ],
  },
  live: {
    here: [
      { id: "0f5f2f4e-0000-4000-8000-000000000001", doing: "crave" },
      // a click is named by its text, which can run long
      {
        id: "0f5f2f4e-0000-4000-8000-000000000002",
        doing: "USutexas.eduvisit 7you12m agoChrome · macOS · desktop · 2m 22s",
      },
    ],
  },
  visit: {
    visit: {
      id: "0f5f2f4e-0000-4000-8000-000000000001", visitor_id: 1204,
      started_at: new Date(Date.now() - 20 * 60000).toISOString(),
      duration_ms: 142000, events: 6, country: "US", org: "utexas.edu", rdns: null,
      browser: "Chrome", browser_version: "141.0", os: "macOS", device: "desktop",
      surface: "desktop", referrer_host: "linkedin.com", referrer_path: "/feed",
      utm_source: "linkedin", utm_medium: "social", utm_campaign: "resume-2026",
      ref: "resume", landing_path: "/", viewport_w: 1512, viewport_h: 950,
      screen_w: 1728, screen_h: 1117, dpr: 2, timezone: "America/Chicago",
      language: "en-US", prefers_dark: false, reduced_motion: false, authed: false,
    },
    events: [
      { seq: 0, name: "session_start", target: "desktop", at: new Date(Date.now() - 20 * 60000).toISOString() },
      { seq: 1, name: "click", target: "Projects", at: new Date(Date.now() - 19.9 * 60000).toISOString() },
      { seq: 2, name: "window_open", target: "finder", at: new Date(Date.now() - 19.8 * 60000).toISOString() },
      { seq: 3, name: "project_open", target: "crave", at: new Date(Date.now() - 19.4 * 60000).toISOString() },
      { seq: 4, name: "terminal_command", target: "neofetch", at: new Date(Date.now() - 18.6 * 60000).toISOString() },
      { seq: 5, name: "link_click", target: "github.com", at: new Date(Date.now() - 17.7 * 60000).toISOString() },
    ],
  },
  heatmap: {
    days: 30,
    surface: "desktop",
    points: Array.from({ length: 120 }, (_, i) => ({
      x: 0.2 + ((i * 37) % 60) / 100,
      y: 0.25 + ((i * 53) % 55) / 100,
      target: "dock",
    })),
  },
};

const history = (base) =>
  Array.from({ length: 90 }, (_, i) => ({
    at: new Date(Date.now() - (90 - i) * 30000).toISOString(),
    cpuPct: base + Math.sin(i / 3) * 5,
    memPct: 40 + Math.sin(i / 5) * 2,
  }));

export const fleet = {
  version: "1.0.0",
  deployedSecondsAgo: 60,
  env: "production",
  servers: [
    {
      slug: "hub",
      name: "Hub",
      stale: false,
      lastSeenAt: new Date().toISOString(),
      agentVersion: null,
      updateAvailable: false,
      osName: "Linux 6.1",
      cores: 4,
      uptimeSeconds: 2 * 86400 + 23 * 3600,
      appMemMb: 89,
      sample: {
        cpuPct: 3.1, memPct: 7.2, memUsedMb: 1700, memTotalMb: 23400,
        source: "os", diskPct: 41.8, diskUsedGb: 84.2, diskTotalGb: 201.4, load1: 1.42,
      },
      history: history(4),
      units: null,
      failedUnits: null,
    },
    {
      slug: "vps",
      name: "VPS",
      stale: false,
      lastSeenAt: new Date().toISOString(),
      agentVersion: "1.2.0",
      updateAvailable: false,
      osName: "Debian 12",
      cores: 2,
      uptimeSeconds: 96 * 3600,
      appMemMb: null,
      sample: {
        cpuPct: 4.1, memPct: 52.0, memUsedMb: 4260, memTotalMb: 8192,
        diskPct: 91.3, diskUsedGb: 73.0, diskTotalGb: 80.0, load1: 3.1,
      },
      history: history(5),
      failedUnits: 0,
      units: [
        { n: "nginx.service", a: "active", s: "running", r: 0 },
        { n: "apache2.service", a: "active", s: "running", r: 0 },
        { n: "mariadb.service", a: "active", s: "running", r: 2 },
        { n: "dovecot.service", a: "active", s: "running", r: 0 },
        { n: "exim4.service", a: "active", s: "running", r: 0 },
        { n: "sshd.service", a: "active", s: "running", r: 0 },
      ],
    },
  ],
  tailnet: {
    configured: true,
    ok: true,
    checkedAt: new Date().toISOString(),
    devices: [
      { name: "hub", os: "linux", online: true, lastSeen: new Date().toISOString(), address: "100.64.0.1", version: "1.88.1", updateAvailable: false, keyExpiry: null },
      { name: "vps", os: "linux", online: true, lastSeen: new Date().toISOString(), address: "100.64.0.2", version: "1.86.2", updateAvailable: true, keyExpiry: new Date(Date.now() + 5 * 86400000).toISOString() },
      { name: "iphone", os: "iOS", online: true, lastSeen: new Date().toISOString(), address: "100.64.0.3", version: "1.88.1", updateAvailable: false, keyExpiry: null },
      { name: "macbook", os: "macOS", online: false, lastSeen: new Date(Date.now() - 2 * 86400000).toISOString(), address: "100.64.0.4", version: "1.88.1", updateAvailable: false, keyExpiry: null },
    ],
  },
  services: [
    {
      slug: "portfolio", name: "Portfolio", url: "https://tanushchauhan.com", server: "hub",
      ok: true, status: 200, latencyMs: 42, error: null, stale: false,
      since: new Date(Date.now() - 9 * 86400000).toISOString(),
      checkedAt: new Date().toISOString(),
    },
    {
      slug: "open-webui", name: "Open WebUI", url: "https://chat.example.com", server: "hub",
      ok: true, status: 200, latencyMs: 118, error: null, stale: false,
      since: new Date(Date.now() - 3 * 86400000).toISOString(),
      checkedAt: new Date().toISOString(),
    },
    {
      slug: "panel", name: "Control panel", url: "https://panel.example.com", server: "vps",
      ok: true, status: 200, latencyMs: 87, error: null, stale: false,
      since: new Date(Date.now() - 86400000).toISOString(),
      checkedAt: new Date().toISOString(),
    },
    {
      slug: "webmail", name: "Webmail", url: "https://mail.example.com", server: "vps",
      ok: false, status: 502, latencyMs: 8003, error: "HTTP 502", stale: false,
      since: new Date(Date.now() - 23 * 60000).toISOString(),
      checkedAt: new Date().toISOString(),
    },
  ],
};

export const guestbookEntries = [
  {
    id: 1,
    name: "a visitor",
    message: "the terminal is a nice touch and this line is worth quoting back",
    createdAt: "2026-07-30T10:00:00Z",
  },
];

/** A spec can override any route by registering it again. */
export const installFixtures = async (page, { authed = true, building } = {}) => {
  await page.route("**/api/widgets/github", (r) => r.fulfill({ json: github }));
  await page.route("**/api/widgets/building", (r) =>
    r.fulfill({
      json: building ?? { text: "This website!", updatedAt: "2026-07-26T00:00:00Z" },
    })
  );
  await page.route("**/api/moontower/fleet", (r) =>
    authed ? r.fulfill({ json: fleet }) : r.fulfill({ status: 401, json: {} })
  );
  await page.route("**/api/auth/me", (r) =>
    r.fulfill({
      json: authed
        ? { authenticated: true, passkey: "MacBook" }
        : { authenticated: false },
    })
  );
  await page.route("**/api/guestbook", (r) =>
    r.fulfill({ json: { entries: guestbookEntries } })
  );
  await page.route("**/api/health", (r) =>
    r.fulfill({ json: { ok: true, uptimeSeconds: 2 * 86400 + 3 * 3600, env: "production" } })
  );
  await page.route("**/api/visit/stats", (r) =>
    r.fulfill({
      json: {
        total: 1204, visits: 3120, newToday: 18, seenToday: 42,
        newWeek: 120, seenWeek: 260, returning: 301,
      },
    })
  );
  await page.route("**/api/auth/tokens", (r) =>
    r.fulfill({
      json: { tokens: [{ id: "a1b2c3d4", createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 9 * 60000).toISOString() }] },
    })
  );
  await page.route("**/api/moontower/tokens", (r) => r.fulfill({ json: { tokens: [] } }));
  await page.route("**/api/visit", (r) =>
    r.fulfill({ json: { number: 1204, visits: 1, since: "2026-09-01T00:00:00Z", total: 1204 } })
  );

  await page.route("**/api/tel/overview*", (r) => r.fulfill({ json: tel.overview }));
  await page.route("**/api/tel/traffic*", (r) => r.fulfill({ json: tel.traffic }));
  await page.route("**/api/tel/sessions*", (r) => r.fulfill({ json: tel.sessions }));
  await page.route("**/api/tel/funnel*", (r) => r.fulfill({ json: tel.funnel }));
  await page.route("**/api/tel/paths*", (r) => r.fulfill({ json: tel.paths }));
  await page.route("**/api/tel/heatmap*", (r) => r.fulfill({ json: tel.heatmap }));
  await page.route("**/api/tel/people*", (r) => r.fulfill({ json: tel.people }));
  await page.route("**/api/tel/events*", (r) => r.fulfill({ json: tel.events }));
  await page.route("**/api/tel/live", (r) => r.fulfill({ json: tel.live }));
  await page.route("**/api/tel/visit/*", (r) => r.fulfill({ json: tel.visit }));
};
