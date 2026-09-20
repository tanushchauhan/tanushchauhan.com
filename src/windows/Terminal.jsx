import { useEffect, useRef, useState } from "react";
import dayjs from "dayjs";
import WindowWrapper from "#hoc/WindowWrapper.jsx";
import { WindowControls } from "#components";
import { techStack, locations } from "#constants";
import useWindowStore from "#store/window.js";
import useAuthStore from "#store/auth.js";
import { MatrixOverlay, SnakeOverlay } from "./TermOverlay.jsx";
import { refreshWidgets } from "../utils/widgets.js";
import { registerVisit } from "../utils/visit.js";
import { MAN } from "#constants/man.js";

const USER = "tanush@tanushchauhan.com";

const NEOFETCH = `
         ◆               tanush @ tanushchauhan.com
  ─────────────────────────────────────────
  OS        tanushchauhan.com 1.0
  Host      UT Austin
  Kernel    CS Honors + Math + Robotics
  Shell     /bin/ros2
  Packages  react, ros2, supabase, postgres
  Location  Austin, TX`;

const FORTUNES = [
  "Calibrate the cameras. Then calibrate them again.",
  "The best time to start a hackathon project was 36 hours ago. The second best time is now.",
  "Real shells have no 'undo'. This one has no 'rm'. Call it even.",
  "Somewhere a LiDAR point cloud is aligning perfectly. Not this one.",
  "Reviewer 2 has notes. Reviewer 2 always has notes.",
  "Every demo works until someone else holds the laptop.",
  "The bug is in the part you were sure about.",
  "Two weeks of debugging can save you an afternoon of reading the docs.",
];

const cowsay = (text) => {
  const msg = text || "moo?";
  const lines = [];
  let line = "";
  for (const word of msg.split(/\s+/)) {
    if ((line + " " + word).trim().length > 34) {
      lines.push(line.trim());
      line = word;
    } else line += " " + word;
  }
  if (line.trim()) lines.push(line.trim());
  const width = Math.max(...lines.map((l) => l.length));
  const bubble = [
    " " + "_".repeat(width + 2),
    ...lines.map(
      (l, i) =>
        `${lines.length === 1 ? "<" : i === 0 ? "/" : i === lines.length - 1 ? "\\" : "|"} ${l.padEnd(width)} ${lines.length === 1 ? ">" : i === 0 ? "\\" : i === lines.length - 1 ? "/" : "|"}`
    ),
    " " + "-".repeat(width + 2),
  ];
  return [
    ...bubble,
    "        \\   ^__^",
    "         \\  (oo)\\_______",
    "            (__)\\       )\\/\\",
    "                ||----w |",
    "                ||     ||",
  ].join("\n");
};

/* ---------- virtual filesystem (mirrors the Finder) ---------- */
const fileNode = (item) => ({ name: item.name, kind: "file", item });

const FS_ROOT = {
  name: "~",
  kind: "dir",
  children: [
    {
      name: "projects",
      kind: "dir",
      loc: locations.work,
      children: locations.work.children.map((p) => ({
        name: p.id,
        kind: "dir",
        loc: p,
        children: p.children.map(fileNode),
      })),
    },
    {
      name: "publications",
      kind: "dir",
      loc: locations.publications,
      children: locations.publications.children.map((paper) => ({
        name: paper.id,
        kind: "dir",
        loc: paper,
        children: paper.children.map(fileNode),
      })),
    },
    {
      name: "about",
      kind: "dir",
      loc: locations.about,
      children: locations.about.children.map(fileNode),
    },
    {
      name: "trash",
      kind: "dir",
      loc: locations.trash,
      children: locations.trash.children.map(fileNode),
    },
    {
      name: ".secret",
      kind: "file",
      hidden: true,
      secret: [
        "you found the hidden file.",
        "there is a poster of me in here that did not fit anywhere else.",
        "run 'poster' to see it.",
        "",
        "and if you want to build something together, 'open contact'.",
      ],
    },
  ],
};

const nodeAt = (path) => {
  let node = FS_ROOT;
  for (const part of path) {
    node = node.children?.find((c) => c.name.toLowerCase() === part.toLowerCase());
    if (!node) return null;
  }
  return node;
};

// resolve a path string against the cwd; returns { node, path } or null
const resolve = (cwd, raw) => {
  if (!raw) return { node: nodeAt(cwd), path: [...cwd] };
  if (raw === "~" || raw === "/") return { node: FS_ROOT, path: [] };

  const parts = raw.split("/").filter((p) => p.length);
  let path = [...cwd];
  if (raw.startsWith("~") || raw.startsWith("/")) {
    path = [];
    if (parts[0] === "~") parts.shift();
  }

  for (const part of parts) {
    if (part === ".") continue;
    if (part === "..") {
      path.pop();
      continue;
    }
    const dir = nodeAt(path);
    const child = dir?.children?.find(
      (c) => c.name.toLowerCase() === part.toLowerCase()
    );
    if (!child) return null;
    path.push(child.name);
  }
  return { node: nodeAt(path), path };
};

const pwdString = (path) => "~" + (path.length ? "/" + path.join("/") : "");

/** Seconds as "3d 4h", "4h 20m" or "9m", the way uptime(1) reads. */
const durationOf = (seconds) => {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d) return `${d}d ${h}h`;
  if (h) return `${h}h ${m}m`;
  return `${Math.max(1, m)}m`;
};

// set by vite.config.js at build time
const BUILD = __BUILD__;

const COMMAND_NAMES = [
  "help", "man", "ls", "cd", "cat", "open", "pwd", "whoami", "skills", "projects",
  "contact", "visitor", "uptime", "neofetch", "echo", "date", "history", "clear",
  "grep", "theme", "cowsay", "fortune", "matrix", "snake",
  "login", "logout", "enroll", "passkeys", "building", "stats", "tokens",
  "moontower", "services", "tailnet", "guestbook",
];

/** A default nickname for a newly enrolled passkey, so it is identifiable later. */
const deviceName = () => {
  const ua = navigator.userAgent;
  const platform = /iPhone/.test(ua)
    ? "iPhone"
    : /iPad/.test(ua)
      ? "iPad"
      : /Mac/.test(ua)
        ? "Mac"
        : /Android/.test(ua)
          ? "Android"
          : /Windows/.test(ua)
            ? "Windows"
            : "device";
  const browser = /Firefox/.test(ua)
    ? "Firefox"
    : /Edg\//.test(ua)
      ? "Edge"
      : /Chrome/.test(ua)
        ? "Chrome"
        : /Safari/.test(ua)
          ? "Safari"
          : "browser";
  return `${platform} (${browser})`;
};

const WELCOME_LINES = [
  { type: "out", text: "tanushchauhan.com, last login: just now" },
  { type: "out", text: "Type 'help' for the list of commands.\n" },
];

const SESSION_KEY = "tanushos-term-v1";

const loadSession = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(SESSION_KEY));
    if (saved?.history?.length) return saved;
  } catch {
  }
  return { history: WELCOME_LINES, cwd: [], cmdHistory: [] };
};

// shared by the desktop window and the mobile app
export const TerminalBody = () => {
  const { openWindow, openFinderWindow, setTheme, windows } = useWindowStore();
  const auth = useAuthStore();
  const isOpen = windows.terminal.isOpen;
  const [overlay, setOverlay] = useState(null); // "matrix" | "snake" | null
  const [busy, setBusy] = useState(false); // a command is still running

  const [session] = useState(loadSession);
  const [history, setHistory] = useState(session.history);
  const [cwd, setCwd] = useState(session.cwd);
  const [input, setInput] = useState("");
  const [cmdHistory, setCmdHistory] = useState(session.cmdHistory);
  const [histIdx, setHistIdx] = useState(-1);
  const inputRef = useRef(null);
  const bodyRef = useRef(null);

  useEffect(() => {
    localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({
        history: history.slice(-200),
        cwd,
        cmdHistory: cmdHistory.slice(-50),
      })
    );
  }, [history, cwd, cmdHistory]);

  // contentEditable rather than an <input>, so password managers leave it alone
  const setInputText = (text) => {
    const el = inputRef.current;
    setInput(text);
    if (!el) return;
    el.textContent = text;
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  };

  const prompt = `${USER} ${pwdString(cwd)} %`;

  const print = (lines) =>
    setHistory((h) => [...h, ...lines.map((text) => ({ type: "out", text }))]);

  /* ---------- open files / folders / apps in real windows ---------- */
  const openNode = (node) => {
    if (node.kind === "dir") {
      openFinderWindow(node.loc ?? null);
      return print([`Opening ${node.name}/ in Finder…`]);
    }
    if (node.secret) return print(node.secret);

    const item = node.item;
    if (["fig", "url"].includes(item.fileType) && item.href) {
      window.open(item.href, "_blank", "noopener,noreferrer");
      return print([`Opening ${item.href} in a new tab…`]);
    }
    openWindow(`${item.fileType}File`, item.data);
    print([`Opening ${item.name}…`]);
  };

  const APPS = {
    projects: "finder",
    finder: "finder",
    gallery: "photos",
    photos: "photos",
    highlights: "safari",
    safari: "safari",
    contact: "contact",
    about: "about",
  };

  /* ---------- commands ---------- */
  const commands = {
    help: () =>
      print([
        "  man <command>    the manual page for a command",
        "  ls [-a] [dir]    list directory contents",
        "  cd <dir>         change directory (try 'cd projects/crave')",
        "  cat <file>       view file contents",
        "  open <target>    open files, folders, or apps in a window",
        "                   apps: projects · gallery · highlights · contact",
        "  pwd              print working directory",
        "  whoami           the short version",
        "  skills           tech stack, by category",
        "  projects         what I have built, one line each",
        "  contact          how to reach me",
        "  visitor          which number you are",
        "  uptime           how long the server has been up, and which build",
        "  neofetch         system information",
        "  echo <text>      print text",
        "  date             current date & time",
        "  history          command history",
        "  grep <p> <file>  print lines matching a pattern",
        "  theme <mode>     light | dark | auto",
        "  cowsay <text>    a cow says it",
        "  fortune          questionable wisdom",
        "  matrix           green rain",
        "  snake            arrows to move, esc to quit",
        "  clear            clear terminal",
        "",
        "  login            sign in with a passkey (Touch ID / Face ID)",
        "  logout           end the session",
        "  passkeys         list registered passkeys",
        "  building [text]  read or set the 'now building' widget",
        "  stats            visitor numbers",
        "  tokens           one-time tokens that have not been used yet",
        "  moontower        the machines, and how to add one",
        "  services         the applications, probed over http",
        "  tailnet          every device on the tailnet, and when it was last seen",
        "  guestbook        read the guestbook, hide or delete an entry",
      ]),

    ls: (args) => {
      const showHidden = args.includes("-a");
      const target = args.find((a) => !a.startsWith("-"));
      const res = resolve(cwd, target ?? "");
      if (!res) return print([`ls: no such file or directory: ${target}`]);
      if (res.node.kind === "file") return print([res.node.name]);

      const entries = (res.node.children ?? [])
        .filter((c) => showHidden || !c.hidden)
        .map((c) => (c.kind === "dir" ? c.name + "/" : c.name));
      print([entries.length ? entries.join("   ") : "(empty)"]);
    },

    cd: (args) => {
      const res = resolve(cwd, args[0] ?? "~");
      if (!res) return print([`cd: no such directory: ${args[0]}`]);
      if (res.node.kind !== "dir") return print([`cd: not a directory: ${args[0]}`]);
      setCwd(res.path);
    },

    cat: (args) => {
      if (!args[0]) return print(["usage: cat <file>"]);
      const res = resolve(cwd, args[0]);
      if (!res) return print([`cat: no such file: ${args[0]}`]);
      const { node } = res;
      if (node.kind === "dir") return print([`cat: ${node.name}: is a directory`]);
      if (node.secret) return print(node.secret);

      const item = node.item;
      if (item.fileType === "txt" && item.data) {
        return print([
          ...(item.data.subtitle ? [`# ${item.data.subtitle}`, ""] : []),
          ...item.data.description,
        ]);
      }
      if (item.fileType === "url") return print([`-> ${item.href}`]);
      if (item.fileType === "img")
        return print([`binary image data, try 'open ${node.name}'`]);
      print([`cat: cannot read ${node.name}`]);
    },

    open: (args) => {
      if (!args[0]) return print(["usage: open <file | folder | app>"]);
      const key = args[0].toLowerCase();
      if (APPS[key] && !resolve(cwd, args[0])) {
        if (key === "projects" || key === "finder") {
          openFinderWindow(locations.work);
        } else {
          openWindow(APPS[key]);
        }
        return print([`Opening ${key}…`]);
      }
      const res = resolve(cwd, args[0]);
      if (res) return openNode(res.node);
      print([`open: no such file, folder, or app: ${args[0]}`]);
    },

    pwd: () => print([pwdString(cwd)]),

    whoami: () =>
      print([
        "Tanush Chauhan, CS Honors + Math @ UT Austin, Robotics minor.",
        "Undergrad researcher at the Autonomous Mobile Robotics Lab, tracking people",
        "in 3D across six synchronized cameras. Co-author on STARS (CoRL 2026) and",
        "MemeQA (ACL 2025).",
        "",
        auth.status === "authed"
          ? `session: authenticated via passkey '${auth.passkey}'.`
          : "session: guest (read-only).",
      ]),

    skills: () =>
      print(
        techStack.map(
          ({ category, items }) => `  ${category.padEnd(14)} ${items.join(", ")}`
        )
      ),

    projects: () =>
      print([
        ...locations.work.children.map((p) => {
          const about = p.children?.[0]?.data;
          return `  ${p.name.padEnd(12)} ${about?.subtitle ?? ""}`;
        }),
        "",
        "'cd projects/crave' then 'cat about.txt', or 'open projects'.",
      ]),

    contact: () =>
      print([
        "  email     tanush@utexas.edu",
        "  github    github.com/tanushchauhan",
        "  linkedin  linkedin.com/in/tanushchauhan",
        "",
        "'open contact' for the window version.",
      ]),

    // shares App's request, so it does not count as a second visit
    visitor: async () => {
      const visit = await registerVisit();
      if (!visit) return print(["visitor: could not reach the server."]);
      const back = visit.visits - 1;
      print([
        `you are visitor number ${visit.number.toLocaleString()}.`,
        back
          ? `${visit.total.toLocaleString()} people have been here, and you have come back ${back} time${back === 1 ? "" : "s"}.`
          : `${visit.total.toLocaleString()} people have been here, and this is your first time.`,
      ]);
    },

    man: (args) => {
      const name = (args[0] ?? "").toLowerCase();
      if (!name) return print(["usage: man <command>. `help` lists them."]);

      const entry = MAN[name];
      if (!entry) return print([`No manual entry for ${name}.`]);

      return print([
        `  ${entry.usage}`,
        "",
        `  ${entry.summary}`,
        ...entry.notes.map((note) => `  ${note}`),
      ]);
    },

    uptime: async () => {
      try {
        const res = await fetch("/api/health");
        if (!res.ok) throw new Error();
        const { uptimeSeconds, env } = await res.json();
        const build = [BUILD.commit, dayjs(BUILD.builtAt).format("MMM D YYYY")]
          .filter(Boolean)
          .join(" · ");
        return print([
          `  up ${durationOf(uptimeSeconds)} since the last deploy`,
          `  build ${build}${env ? ` · ${env}` : ""}`,
        ]);
      } catch {
        return print(["uptime: could not reach the server."]);
      }
    },

    neofetch: () => print([NEOFETCH]),

    echo: (args) => print([args.join(" ")]),

    date: () => print([dayjs().format("ddd MMM D YYYY, h:mm:ss A")]),

    history: (_, allCmds) =>
      print(allCmds.map((c, i) => `  ${String(i + 1).padStart(3)}  ${c}`)),

    clear: () => setHistory([]),

    grep: (args) => {
      const [pattern, target] = args;
      if (!pattern || !target) return print(["usage: grep <pattern> <file>"]);
      const res = resolve(cwd, target);
      if (!res || res.node.kind !== "file")
        return print([`grep: no such file: ${target}`]);
      const item = res.node.item;
      const lines =
        res.node.secret ??
        (item?.fileType === "txt" && item.data
          ? [item.data.subtitle ?? "", ...item.data.description]
          : null);
      if (!lines) return print([`grep: ${target}: not a text file`]);
      const hits = lines.filter((l) =>
        l.toLowerCase().includes(pattern.toLowerCase())
      );
      print(hits.length ? hits : [`grep: no matches for '${pattern}'`]);
    },

    theme: (args) => {
      const mode = args[0]?.toLowerCase();
      if (!["light", "dark", "auto"].includes(mode))
        return print(["usage: theme <light | dark | auto>"]);
      setTheme(mode);
      print([`Appearance set to ${mode}.${mode === "dark" ? " 🌙" : ""}`]);
    },

    cowsay: (args) => print([cowsay(args.join(" "))]),

    fortune: () =>
      print([FORTUNES[Math.floor(Math.random() * FORTUNES.length)]]),

    matrix: () => {
      inputRef.current?.blur();
      setOverlay("matrix");
    },

    snake: () => {
      inputRef.current?.blur();
      setOverlay("snake");
    },

    /* ---------- auth ---------- */
    login: async () => {
      if (auth.status === "authed") return print(["already signed in."]);
      print(["waiting for passkey…"]);
      print([await auth.login()]);
    },

    logout: async () => {
      if (auth.status !== "authed") return print(["not signed in."]);
      print([await auth.logout()]);
    },

    enroll: async (args) => {
      const token = args[0];
      if (!token && auth.status !== "authed") {
        return print([
          "usage: enroll <token>",
          "",
          "Tokens are minted inside the container, which is the point: this is",
          "the one way in that does not require an existing passkey.",
          "",
          "  docker exec -it <container> bun server/src/admin/token.ts",
        ]);
      }
      print(["waiting for passkey…"]);
      print([await auth.enroll(token, args[1] ?? deviceName())]);
    },

    passkeys: async () => {
      if (auth.status !== "authed") return print(["passkeys: not signed in."]);
      try {
        const res = await fetch("/api/auth/passkeys", { credentials: "same-origin" });
        const { passkeys = [] } = await res.json();
        print(
          passkeys.length
            ? passkeys.map((k) => {
                const added = dayjs(k.createdAt).format("MMM D YYYY");
                const used = k.lastUsedAt
                  ? dayjs(k.lastUsedAt).format("MMM D YYYY")
                  : "never";
                return `  ${k.nickname.padEnd(22)} added ${added}, last used ${used}`;
              })
            : ["  (none)"]
        );
      } catch {
        print(["passkeys: could not reach the server."]);
      }
    },

    stats: async () => {
      if (auth.status !== "authed") return print(["stats: not signed in."]);
      try {
        const res = await fetch("/api/visit/stats", { credentials: "same-origin" });
        if (!res.ok) throw new Error();
        const s = await res.json();
        const share = s.total ? Math.round((s.returning / s.total) * 100) : 0;
        return print([
          `  visitors      ${s.total.toLocaleString()} · ${s.visits.toLocaleString()} visits`,
          `  today         ${s.seenToday} here, ${s.newToday} for the first time`,
          `  this week     ${s.seenWeek} here, ${s.newWeek} for the first time`,
          `  came back     ${s.returning.toLocaleString()} (${share}%)`,
        ]);
      } catch {
        return print(["stats: could not reach the server."]);
      }
    },

    tokens: async (args) => {
      if (auth.status !== "authed") return print(["tokens: not signed in."]);
      const [sub, id] = args;

      if (sub === "revoke") {
        if (!id) return print(["usage: tokens revoke <id>"]);
        // the id says nothing about which kind it is, so try both
        const results = await Promise.all(
          ["/api/auth/tokens", "/api/moontower/tokens"].map((path) =>
            fetch(`${path}/${encodeURIComponent(id)}`, {
              method: "DELETE",
              credentials: "same-origin",
            })
              .then((r) => r.ok)
              .catch(() => false)
          )
        );
        return print([
          results.some(Boolean) ? `revoked ${id}.` : `tokens: no live token starting ${id}.`,
        ]);
      }

      if (sub) return print(["usage: tokens [revoke <id>]"]);

      try {
        const kinds = [
          ["passkey", "/api/auth/tokens"],
          ["agent", "/api/moontower/tokens"],
        ];
        const lists = await Promise.all(
          kinds.map(async ([kind, path]) => {
            const res = await fetch(path, { credentials: "same-origin" });
            if (!res.ok) throw new Error();
            const { tokens = [] } = await res.json();
            return tokens.map((t) => ({ ...t, kind }));
          })
        );

        const live = lists.flat();
        if (!live.length) return print(["  (none outstanding)"]);

        return print(
          live.map((t) => {
            const minutes = Math.max(0, Math.round((new Date(t.expiresAt) - Date.now()) / 60000));
            return `  ${t.id}  ${t.kind.padEnd(8)} expires in ${minutes}m`;
          })
        );
      } catch {
        return print(["tokens: could not reach the server."]);
      }
    },

    moontower: async (args) => {
      const [sub, ...rest] = args;

      if (auth.status !== "authed") {
        return print(["moontower: not signed in. run 'sudo' first."]);
      }

      if (sub === "enroll") {
        const name = rest.join(" ").trim();
        if (!name) return print(["usage: moontower enroll <server name>"]);
        try {
          const res = await fetch("/api/moontower/enroll-token", {
            method: "POST",
            credentials: "same-origin",
          });
          const data = await res.json();
          if (!res.ok) return print([`moontower: ${data.error}`]);
          return print([
            `enrollment token minted, single use, expires in ${data.minutes} minutes.`,
            "",
            "run this on the server you want to add:",
            "",
            `  curl -fsSL ${location.origin}/moontower/install.sh | sh -s -- \\`,
            `      --token ${data.token} \\`,
            `      --name "${name}"`,
            "",
            "the agent runs unprivileged and only reads /proc.",
          ]);
        } catch {
          return print(["moontower: could not reach the server."]);
        }
      }

      if (sub === "remove") {
        const slug = rest.join("").trim();
        if (!slug) return print(["usage: moontower remove <slug>"]);
        try {
          const res = await fetch(`/api/moontower/servers/${encodeURIComponent(slug)}`, {
            method: "DELETE",
            credentials: "same-origin",
          });
          const data = await res.json();
          return print([
            res.ok
              ? `removed '${data.removed}'. its key no longer works.`
              : `moontower: ${data.error}`,
          ]);
        } catch {
          return print(["moontower: could not reach the server."]);
        }
      }

      try {
        const res = await fetch("/api/moontower/fleet", { credentials: "same-origin" });
        const data = await res.json();
        if (!res.ok) return print([`moontower: ${data.error}`]);
        return print([
          "fleet:",
          ...data.servers.map((s) => {
            const state = s.stale ? "stale" : "reporting";
            const cpu = s.sample?.cpuPct != null ? `${s.sample.cpuPct}% cpu` : "no reading";
            const disk = s.sample?.diskPct != null ? `  ${Math.round(s.sample.diskPct)}% disk` : "";
            const broken = (s.units ?? []).filter((u) => u.a !== "active");
            const units = !s.units?.length
              ? ""
              : broken.length
                ? `  ${broken.map((u) => u.n.replace(/\.service$/, "")).join(",")} down`
                : `  ${s.units.length} units ok`;
            return `  ${s.slug.padEnd(12)} ${state.padEnd(10)} ${cpu.padEnd(12)}${disk}${units}`;
          }),
          "",
          "moontower enroll <name>   add a server",
          "moontower remove <slug>   revoke and forget one",
          "services                  the applications, probed over http",
        ]);
      } catch {
        return print(["moontower: could not reach the server."]);
      }
    },

    services: async (args) => {
      const [sub, ...rest] = args;

      if (auth.status !== "authed") {
        return print(["services: not signed in. run 'sudo' first."]);
      }

      if (sub === "add") {
        const url = rest[rest.length - 1] ?? "";
        const name = rest.slice(0, -1).join(" ").trim();
        if (!name || !url) return print(["usage: services add <name> <url>"]);
        try {
          const res = await fetch("/api/moontower/services", {
            method: "POST",
            credentials: "same-origin",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ name, url }),
          });
          const data = await res.json();
          if (!res.ok) return print([`services: ${data.error}`]);
          return print([
            `watching '${data.slug}'.`,
            data.ok
              ? `  answered ${data.status} in ${data.latencyMs}ms.`
              : `  it is not answering right now: ${data.error}`,
          ]);
        } catch {
          return print(["services: could not reach the server."]);
        }
      }

      if (sub === "rm" || sub === "remove") {
        const slug = rest.join("").trim();
        if (!slug) return print(["usage: services rm <slug>"]);
        try {
          const res = await fetch(`/api/moontower/services/${encodeURIComponent(slug)}`, {
            method: "DELETE",
            credentials: "same-origin",
          });
          const data = await res.json();
          return print([res.ok ? `stopped watching '${data.removed}'.` : `services: ${data.error}`]);
        } catch {
          return print(["services: could not reach the server."]);
        }
      }

      try {
        const res = await fetch("/api/moontower/fleet", { credentials: "same-origin" });
        const data = await res.json();
        if (!res.ok) return print([`services: ${data.error}`]);
        if (!data.services?.length) {
          return print([
            "nothing watched yet.",
            "",
            "services add <name> <url>   probe it every minute",
          ]);
        }
        return print([
          "services:",
          ...data.services.map((s) => {
            const state = s.stale
              ? "no check"
              : s.ok === null
                ? "checking"
                : s.ok
                  ? "up"
                  : "DOWN";
            const detail = s.stale
              ? (s.checkedAt ? `last seen ${new Date(s.checkedAt).toLocaleTimeString()}` : "never checked")
              : s.ok
                ? `${s.latencyMs}ms`
                : s.ok === false
                  ? (s.error ?? "no answer")
                  : "";
            return `  ${s.slug.padEnd(14)} ${state.padEnd(9)} ${detail}`;
          }),
          "",
          "services add <name> <url>   probe it every minute",
          "services rm <slug>          stop watching one",
        ]);
      } catch {
        return print(["services: could not reach the server."]);
      }
    },

    // read-only: this never connects to a device
    tailnet: async () => {
      if (auth.status !== "authed") {
        return print(["tailnet: not signed in. run 'sudo' first."]);
      }
      try {
        const res = await fetch("/api/moontower/fleet", { credentials: "same-origin" });
        const data = await res.json();
        if (!res.ok) return print([`tailnet: ${data.error}`]);
        const t = data.tailnet;
        if (!t?.configured) {
          return print([
            "tailnet: not configured.",
            "  set TS_OAUTH_CLIENT_ID and TS_OAUTH_CLIENT_SECRET on the server,",
            "  from an OAuth client with only the devices:core:read scope.",
          ]);
        }
        if (!t.ok) return print([`tailnet: ${t.error}`]);

        const since = (iso) => {
          const s = (Date.now() - new Date(iso)) / 1000;
          if (!Number.isFinite(s)) return "never";
          if (s < 3600) return `${Math.max(1, Math.round(s / 60))}m ago`;
          if (s < 86400) return `${Math.round(s / 3600)}h ago`;
          return `${Math.round(s / 86400)}d ago`;
        };
        const soon = Date.now() + 14 * 86400 * 1000;
        const online = t.devices.filter((d) => d.online).length;

        return print([
          `tailnet: ${online} of ${t.devices.length} online`,
          ...t.devices.map((d) => {
            const state = d.online ? "online" : since(d.lastSeen);
            const notes = [
              d.version && `v${d.version}${d.updateAvailable ? " (update available)" : ""}`,
              d.keyExpiry && new Date(d.keyExpiry) < soon &&
                `key expires ${new Date(d.keyExpiry).toLocaleDateString()}`,
            ].filter(Boolean);
            return `  ${d.name.padEnd(16)} ${state.padEnd(9)} ${(d.os ?? "").padEnd(8)} ${(d.address ?? "").padEnd(16)} ${notes.join("  ")}`;
          }),
        ]);
      } catch {
        return print(["tailnet: could not reach the server."]);
      }
    },

    // hiding is reversible, so it is the default
    guestbook: async (args) => {
      const [sub, ...rest] = args;

      if (auth.status !== "authed") {
        return print(["guestbook: not signed in. run 'sudo' first."]);
      }

      const ids = rest.map(Number).filter((n) => Number.isInteger(n) && n > 0);

      if (sub === "hide" || sub === "show" || sub === "rm" || sub === "remove") {
        if (!ids.length) return print([`usage: guestbook ${sub} <id> [id...]`]);

        const hiding = sub === "hide";
        const removing = sub === "rm" || sub === "remove";
        const done = [];
        const failed = [];

        for (const id of ids) {
          try {
            const res = await fetch(`/api/guestbook/${id}`, {
              method: removing ? "DELETE" : "PATCH",
              credentials: "same-origin",
              ...(removing
                ? {}
                : {
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ hidden: hiding }),
                  }),
            });
            if (res.ok) done.push(id);
            else failed.push(`${id} (${(await res.json().catch(() => ({}))).error ?? res.status})`);
          } catch {
            failed.push(`${id} (no answer)`);
          }
        }

        const verb = removing ? "deleted" : hiding ? "hidden" : "visible again";
        return print([
          done.length ? `${done.join(", ")} ${done.length > 1 ? "are" : "is"} ${verb}.` : "",
          failed.length ? `could not touch ${failed.join(", ")}` : "",
        ].filter(Boolean));
      }

      try {
        const res = await fetch("/api/guestbook/all", { credentials: "same-origin" });
        const data = await res.json();
        if (!res.ok) return print([`guestbook: ${data.error}`]);
        if (!data.entries?.length) return print(["the guestbook is empty."]);

        const hidden = data.entries.filter((e) => e.isHidden).length;
        return print([
          `${data.entries.length} entries${hidden ? `, ${hidden} hidden` : ""}:`,
          "",
          ...data.entries.slice(0, 25).map((e) => {
            const flag = e.isHidden ? "-" : " ";
            const who = (e.name ?? "anonymous").slice(0, 14).padEnd(14);
            const body = e.message.replace(/\s+/g, " ").slice(0, 46);
            return `${flag} ${String(e.id).padStart(4)}  ${who} ${(e.source ?? "?").padEnd(9)} ${body}`;
          }),
          data.entries.length > 25 ? `  ... and ${data.entries.length - 25} more` : "",
          "",
          "a leading - means hidden. the column after the name groups entries",
          "that came from the same source, which is how a spam run looks.",
          "",
          "guestbook hide <id...>   take entries off the public list",
          "guestbook show <id...>   put them back",
          "guestbook rm <id...>     delete them outright",
        ].filter(Boolean));
      } catch {
        return print(["guestbook: could not reach the server."]);
      }
    },

    // edits the "now building" widget
    building: async (args) => {
      const text = args.join(" ").trim();
      if (!text) {
        const res = await fetch("/api/widgets/building").catch(() => null);
        const data = await res?.json().catch(() => null);
        return print([
          data?.text ? `currently: ${data.text}` : "nothing set.",
          "",
          "usage: building <what you are working on>",
        ]);
      }
      if (auth.status !== "authed") {
        return print(["building: not signed in. run 'sudo' first."]);
      }
      try {
        const res = await fetch("/api/widgets/building", {
          method: "PUT",
          credentials: "same-origin",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ text }),
        });
        const data = await res.json();
        if (res.ok) refreshWidgets();
        print([res.ok ? `now building: ${data.text}` : `building: ${data.error}`]);
      } catch {
        print(["building: could not reach the server."]);
      }
    },

    // hidden from help and completion; ~/.secret points here
    poster: () => {
      const item = locations.about.children.find((c) => c.id === "poster");
      openWindow("imgFile", item.data);
      print([
        "A one-page version of me, a bit less formal than the résumé.",
      ]);
    },
  };

  const dispatch = (cmd, nextCmdHistory) => {
    const [word, ...args] = cmd.split(/\s+/);
    // phone keyboards capitalise the first word
    const name = word.toLowerCase();
    const handler = commands[name];
    if (handler) return handler(args, nextCmdHistory);

    if (name === "sudo") {
      if (cmd.includes("rm -rf"))
        return print(["nice try, this OS is load-bearing."]);

      if (auth.status === "authed") {
        return print([`already elevated. signed in with '${auth.passkey}'.`]);
      }
      if (auth.needsEnrollment) {
        return print([
          "no passkeys are registered on this deployment yet.",
          "run 'enroll' to see how to mint an enrollment token.",
        ]);
      }
      print(["verifying identity…"]);
      return auth.login().then((message) => print([message]));
    }

    return print([`zsh: command not found: ${word}, type 'help'`]);
  };

  /** Holds the prompt until the command finishes, so output never interleaves. */
  const runCommand = async (raw) => {
    const cmd = raw.trim();
    setHistory((h) => [...h, { type: "cmd", text: cmd, prompt }]);
    if (!cmd) return;

    const nextCmdHistory = [...cmdHistory, cmd];
    setCmdHistory(nextCmdHistory);
    setHistIdx(-1);

    const result = dispatch(cmd, nextCmdHistory);
    if (!(result instanceof Promise)) return;

    setBusy(true);
    try {
      await result;
    } finally {
      setBusy(false);
    }
  };

  /* ---------- tab completion ---------- */
  const complete = () => {
    const tokens = input.split(/\s+/);
    const last = tokens[tokens.length - 1] ?? "";
    const completingCommand = tokens.length <= 1;

    let candidates;
    if (completingCommand || tokens[0]?.toLowerCase() === "man") {
      candidates = COMMAND_NAMES.filter((c) => c.startsWith(last.toLowerCase()));
    } else {
      const slash = last.lastIndexOf("/");
      const dirPart = slash >= 0 ? last.slice(0, slash + 1) : "";
      const namePart = slash >= 0 ? last.slice(slash + 1) : last;
      const res = resolve(cwd, dirPart || "");
      candidates = (res?.node.children ?? [])
        .filter((c) => !c.hidden || namePart.startsWith("."))
        .filter((c) => c.name.toLowerCase().startsWith(namePart.toLowerCase()))
        .map((c) => dirPart + c.name + (c.kind === "dir" ? "/" : ""));
    }

    if (candidates.length === 1) {
      tokens[tokens.length - 1] = candidates[0] + (completingCommand ? " " : "");
      setInputText(tokens.join(" "));
    } else if (candidates.length > 1) {
      setHistory((h) => [
        ...h,
        { type: "cmd", text: input, prompt },
        { type: "out", text: candidates.join("   ") },
      ]);
    }
  };

  const handleKeyDown = (e) => {
    if (overlay) {
      e.preventDefault();
      return;
    }
    if (busy) {
      e.preventDefault();
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      runCommand(input);
      setInputText("");
      return;
    }
    if (e.key === "Tab") {
      e.preventDefault();
      complete();
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!cmdHistory.length) return;
      const idx = histIdx === -1 ? cmdHistory.length - 1 : Math.max(0, histIdx - 1);
      setHistIdx(idx);
      setInputText(cmdHistory[idx]);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (histIdx === -1) return;
      const idx = histIdx + 1;
      if (idx >= cmdHistory.length) {
        setHistIdx(-1);
        setInputText("");
      } else {
        setHistIdx(idx);
        setInputText(cmdHistory[idx]);
      }
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text/plain").replace(/\n/g, " ");
    document.execCommand("insertText", false, text);
  };

  useEffect(() => {
    const body = bodyRef.current;
    if (body) body.scrollTop = body.scrollHeight;
  }, [history]);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  // a passkey prompt steals focus; take it back afterwards
  useEffect(() => {
    if (!busy && isOpen && !overlay) inputRef.current?.focus();
  }, [busy, isOpen, overlay]);

  const exitOverlay = (lines) => {
    setOverlay(null);
    if (lines.length) print(lines);
    // after the exit keystroke finishes, so it does not land in the prompt
    setTimeout(() => {
      setInputText("");
      inputRef.current?.focus();
    }, 150);
  };

  // the games sit beside the scroller, not inside it, so they stay in view
  return (
    <div className="term-frame">
      {overlay === "matrix" && <MatrixOverlay onExit={exitOverlay} />}
      {overlay === "snake" && <SnakeOverlay onExit={exitOverlay} />}
      <div
        ref={bodyRef}
        className="term-body"
        // a click that ends a drag is a text selection; leave it alone
        onClick={() => {
          if (!document.getSelection()?.isCollapsed) return;
          inputRef.current?.focus();
        }}
      >
        {history.map((entry, i) =>
          entry.type === "cmd" ? (
            <p key={i}>
              <span className="prompt">{entry.prompt}</span> {entry.text}
            </p>
          ) : (
            <p key={i} className="out">
              {entry.text}
            </p>
          )
        )}

        <div className="flex items-baseline gap-2" hidden={busy}>
          <span className="prompt shrink-0">{prompt}</span>
          <span
            ref={inputRef}
            className="term-input"
            contentEditable={!overlay && !busy}
            suppressContentEditableWarning
            role="textbox"
            aria-label="terminal input"
            spellCheck={false}
            autoCapitalize="none"
            autoCorrect="off"
            onInput={(e) => setInput(e.currentTarget.textContent)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
          />
        </div>
      </div>
    </div>
  );
};

const Terminal = () => (
  <>
    <div id="window-header">
      <WindowControls target="terminal" />
      <h2>tanush · zsh · 80×24</h2>
    </div>
    <TerminalBody />
  </>
);

const TerminalWindow = WindowWrapper(Terminal, "terminal", { min: { w: 420, h: 240 } });

export default TerminalWindow;
