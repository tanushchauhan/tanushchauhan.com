import { useEffect, useRef, useState } from "react";
import dayjs from "dayjs";
import WindowWrapper from "#hoc/WindowWrapper.jsx";
import { WindowControls } from "#components";
import { techStack, locations } from "#constants";
import useWindowStore from "#store/window.js";
import { MatrixOverlay, SnakeOverlay } from "./TermOverlay.jsx";

const USER = "tanush@tanushchauhan.com";

const NEOFETCH = `
         ◆               tanush @ tanushchauhan.com
  ─────────────────────────────────────────
  OS        tanushchauhan.com 1.0 "Zilker"
  Host      UT Austin, Dean's Scholars
  Kernel    CS Honors + Math + Robotics '29
  Shell     /bin/ros2
  Uptime    building since high school
  Packages  react, ros2, supabase, caffeine
  GPA       3.86 / 4.0
  Location  Austin, TX`;

const CITATION = `
  @inproceedings{memeqa2025,
    title     = {MemeQA: Holistic Evaluation for Meme Understanding},
    author    = {Chauhan, Tanush and others},
    booktitle = {Proceedings of ACL},
    year      = {2025}
  }

  yes, it is a peer-reviewed paper about memes.`;

const FORTUNES = [
  "A robot that follows you is a feature. A robot that follows you home is a paper.",
  "The best time to start a hackathon project was 36 hours ago. The second best time is now.",
  "You will soon publish a peer-reviewed paper about memes. Wait, that already happened.",
  "pgvector remembers what you had for dinner. Crave made sure of it.",
  "Your GPA is a float, but your ambition is a double.",
  "Real shells have no 'undo'. This one has no 'rm'. You're welcome.",
  "Somewhere a LiDAR point cloud is aligning perfectly. Today is your day.",
  "Ship it. The demo gods favor the brave.",
  "Reviewer 2 has notes. Reviewer 2 always has notes.",
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
      name: "about",
      kind: "dir",
      loc: locations.about,
      children: locations.about.children.map(fileNode),
    },
    {
      name: "resume",
      kind: "dir",
      loc: locations.resume,
      children: locations.resume.children.map(fileNode),
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
        "fun fact: this entire OS exists because I refused to build",
        "a portfolio that starts with \"Hi, I'm ___\" and a photo on the right.",
        "",
        "so obviously I hid one in here instead. run 'poster'.",
        "then run 'open contact', let's build something.",
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

const COMMAND_NAMES = [
  "help", "ls", "cd", "cat", "open", "pwd", "whoami", "skills", "projects",
  "contact", "neofetch", "echo", "date", "history", "cite", "clear",
  "grep", "theme", "cowsay", "fortune", "matrix", "snake",
];

const WELCOME_LINES = [
  { type: "out", text: "tanushchauhan.com, last login: just now, from somewhere great" },
  { type: "out", text: "Type 'help' to see what I can do.\n" },
];

// the terminal session survives reloads, like a machine left running
const SESSION_KEY = "tanushos-term-v1";

const loadSession = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(SESSION_KEY));
    if (saved?.history?.length) return saved;
  } catch {
    /* corrupted session, start fresh */
  }
  return { history: WELCOME_LINES, cwd: [], cmdHistory: [] };
};

// the shell itself, reused by the desktop window and the mobile app
export const TerminalBody = () => {
  const { openWindow, openFinderWindow, setTheme, windows } = useWindowStore();
  const isOpen = windows.terminal.isOpen;
  const [overlay, setOverlay] = useState(null); // "matrix" | "snake" | null

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

  // the command line is contentEditable (not an <input>) so password managers
  // like iCloud Passwords don't try to autofill it
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
    if (item.fileType === "pdf") {
      openWindow("resume");
      return print(["Opening resume.pdf…"]);
    }
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
    resume: "resume",
    about: "about",
  };

  /* ---------- commands ---------- */
  const commands = {
    help: () =>
      print([
        "  ls [-a] [dir]    list directory contents",
        "  cd <dir>         change directory (try 'cd projects/crave')",
        "  cat <file>       view file contents",
        "  open <target>    open files, folders, or apps in a window",
        "                   apps: projects · gallery · highlights · contact · resume",
        "  pwd              print working directory",
        "  whoami           who is this guy?",
        "  skills           tech stack, by category",
        "  projects         quick tour of things I've built",
        "  contact          how to reach me",
        "  neofetch         system information",
        "  echo <text>      print text",
        "  date             current date & time",
        "  history          command history",
        "  grep <p> <file>  print lines matching a pattern",
        "  theme <mode>     light | dark | auto",
        "  cowsay <text>    a cow says it",
        "  fortune          questionable wisdom",
        "  cite             bibtex for my ACL 2025 paper",
        "  matrix           follow the white rabbit",
        "  snake            arrows to move, esc to quit",
        "  clear            clear terminal",
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
      if (item.fileType === "pdf")
        return print([`binary PDF, try 'open ${node.name}'`]);
      print([`cat: can't read ${node.name}`]);
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
        "Tanush Chauhan, CS Honors + Math @ UT Austin ('29), Robotics minor.",
        "Undergrad researcher at the Autonomous Mobile Robotics Lab,",
        "hackathon regular, and co-author of a peer-reviewed paper about memes (ACL 2025).",
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
        "Tip: 'cd projects/crave' then 'cat about.txt', or 'open projects'.",
      ]),

    contact: () =>
      print([
        "  email     tanush@utexas.edu",
        "  github    github.com/tanushchauhan",
        "  linkedin  linkedin.com/in/tanushchauhan",
        "",
        "Or run 'open contact' for the pretty version.",
      ]),

    neofetch: () => print([NEOFETCH]),

    echo: (args) => print([args.join(" ")]),

    date: () => print([dayjs().format("ddd MMM D YYYY, h:mm:ss A")]),

    history: (_, allCmds) =>
      print(allCmds.map((c, i) => `  ${String(i + 1).padStart(3)}  ${c}`)),

    cite: () => print([CITATION]),

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

    // deliberately absent from help and from tab completion: the payoff for
    // reading ~/.secret. Same file also sits in ~/about for anyone who browses.
    poster: () => {
      const item = locations.about.children.find((c) => c.id === "poster");
      openWindow("imgFile", item.data);
      print([
        "The version of me that fits on one page, before the résumé sanded it down.",
      ]);
    },
  };

  const runCommand = (raw) => {
    const cmd = raw.trim();
    setHistory((h) => [...h, { type: "cmd", text: cmd, prompt }]);
    if (!cmd) return;

    const nextCmdHistory = [...cmdHistory, cmd];
    setCmdHistory(nextCmdHistory);
    setHistIdx(-1);

    const [name, ...args] = cmd.split(/\s+/);
    const handler = commands[name.toLowerCase()];
    if (handler) return handler(args, nextCmdHistory);

    if (name === "sudo") {
      if (cmd.includes("rm -rf"))
        return print(["nice try, this OS is load-bearing."]);
      return print([
        "tanush is not in the sudoers file. This incident will be reported.",
      ]);
    }

    print([`zsh: command not found: ${name}, type 'help'`]);
  };

  /* ---------- tab completion ---------- */
  const complete = () => {
    const tokens = input.split(/\s+/);
    const last = tokens[tokens.length - 1] ?? "";
    const completingCommand = tokens.length <= 1;

    let candidates;
    if (completingCommand) {
      candidates = COMMAND_NAMES.filter((c) => c.startsWith(last.toLowerCase()));
    } else {
      // complete against children of the path's directory part
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
    // while a game/effect owns the terminal, keys steer it, not the shell
    if (overlay) {
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

  const exitOverlay = (lines) => {
    setOverlay(null);
    if (lines.length) print(lines);
    // refocus after the exit keystroke has fully finished (keydown→input→keyup),
    // so its character can't land in the freshly re-enabled prompt
    setTimeout(() => {
      setInputText("");
      inputRef.current?.focus();
    }, 150);
  };

  return (
    <div
      ref={bodyRef}
      className="term-body"
      onClick={() => inputRef.current?.focus()}
    >
      {overlay === "matrix" && <MatrixOverlay onExit={exitOverlay} />}
      {overlay === "snake" && <SnakeOverlay onExit={exitOverlay} />}
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

        <div className="flex items-baseline gap-2">
          <span className="prompt shrink-0">{prompt}</span>
          <span
            ref={inputRef}
            className="term-input"
            contentEditable={!overlay}
            suppressContentEditableWarning
            role="textbox"
            aria-label="terminal input"
            spellCheck={false}
            onInput={(e) => setInput(e.currentTarget.textContent)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
          />
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

const TerminalWindow = WindowWrapper(Terminal, "terminal");

export default TerminalWindow;
