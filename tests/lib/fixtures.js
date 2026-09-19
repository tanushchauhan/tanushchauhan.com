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
  await page.route("**/api/visit", (r) =>
    r.fulfill({ json: { number: 1204, visits: 1, since: "2026-09-01T00:00:00Z", total: 1204 } })
  );
};
