/**
 * Manual pages, one per command. `help` is the list; this is the detail.
 * Each entry is a usage line, a sentence, and whatever is worth knowing.
 */
const page = (usage, summary, ...notes) => ({ usage, summary, notes });

export const MAN = {
  help: page("help", "List every command, public ones first."),

  man: page(
    "man <command>",
    "Show the manual page for a command.",
    "Tab completes command names."
  ),

  ls: page(
    "ls [-a] [dir]",
    "List what is in a directory.",
    "-a also shows hidden entries, of which there is one worth finding."
  ),

  cd: page(
    "cd <dir>",
    "Change directory.",
    "Accepts .. and absolute paths from ~, as in `cd ~/projects/crave`."
  ),

  cat: page("cat <file>", "Print a file.", "Text files only; images open with `open`."),

  open: page(
    "open <target>",
    "Open a file, folder or app in a real window.",
    "Apps: projects, gallery, highlights, contact, about."
  ),

  pwd: page("pwd", "Print the working directory."),

  whoami: page("whoami", "Who is behind this site, in three lines."),

  skills: page("skills", "The stack, grouped by what it is for."),

  projects: page("projects", "Everything I have built, one line each.", "`open projects` for the windows."),

  contact: page("contact", "Email and the social links."),

  visitor: page(
    "visitor",
    "Which visitor number you are.",
    "Counted once per browser, by a salted hash of your address. The address itself is never stored."
  ),

  uptime: page(
    "uptime",
    "How long the server has been up, and which build it is running.",
    "A restart here is a deploy, so the uptime doubles as the age of this build."
  ),

  neofetch: page("neofetch", "The system information screen, such as it is."),

  echo: page("echo <text>", "Print the text back."),

  date: page("date", "The current date and time, in your timezone."),

  history: page("history", "Every command this session.", "Survives a reload. Up and down walk it."),

  grep: page("grep <pattern> <file>", "Print the lines of a file that match."),

  theme: page("theme <mode>", "Switch appearance: light, dark or auto.", "Auto follows the system."),

  cowsay: page("cowsay <text>", "A cow says it."),

  fortune: page("fortune", "Questionable wisdom."),

  matrix: page("matrix", "Green rain. Any key exits."),

  snake: page("snake", "Snake. Arrows to move, esc to quit."),

  clear: page("clear", "Clear the screen.", "History is kept; `history` still has it."),

  login: page(
    "login",
    "Sign in with a passkey.",
    "Touch ID or Face ID. There is one account and it is mine, but the prompt is real.",
    "`sudo` does the same thing."
  ),

  logout: page("logout", "End the session."),

  enroll: page(
    "enroll <token>",
    "Register a passkey using a one-time token.",
    "Tokens are minted inside the container with `bun run admin:token`."
  ),

  passkeys: page("passkeys", "List registered passkeys, with when each was last used."),

  building: page(
    "building [text]",
    "Read or set the 'now building' widget.",
    "With no text it prints the current line. With text it replaces it, and the card updates at once."
  ),

  stats: page(
    "stats",
    "Visitor numbers: totals, today, this week, and how many came back.",
    "Counts only. Nothing about who anyone is."
  ),

  tokens: page(
    "tokens [revoke <id>]",
    "Outstanding one-time tokens, for passkeys and for agents.",
    "Only unused, unexpired ones are listed, by the first characters of their hash.",
    "The token itself is shown once when minted and never stored."
  ),

  moontower: page(
    "moontower [enroll <name> | remove <slug>]",
    "The machines reporting in, and how to add one.",
    "`enroll` prints an install one-liner to run on the box as root.",
    "`remove` revokes that machine's key and drops its readings."
  ),

  services: page(
    "services [add <name> <url> | rm <slug>]",
    "The applications, checked over HTTP from the hub.",
    "A unit being active does not mean the site behind it answers, which is the point of this."
  ),

  tailnet: page(
    "tailnet",
    "Every device on the tailnet, and when it was last seen.",
    "Read only. This site cannot reach the devices, only ask Tailscale what exists."
  ),

  guestbook: page(
    "guestbook [hide|show|rm <id>]",
    "Read the guestbook, or take an entry down.",
    "Hiding is reversible and keeps the row. rm deletes it."
  ),
};
