import { useCallback, useEffect, useRef, useState } from "react";
import dayjs from "dayjs";
import { Send } from "lucide-react";
import WindowWrapper from "#hoc/WindowWrapper.jsx";
import { WindowControls } from "#components";
import useWindowStore from "#store/window.js";

const MESSAGE_MAX = 500;

/**
 * `active` is what triggers the first fetch. The desktop passes the window's
 * open state, since WindowWrapper keeps every window mounted and merely hides
 * it. Mobile mounts this only when the app is opened, so the default is fine.
 */
export const GuestbookBody = ({ active = true }) => {
  const [entries, setEntries] = useState([]);
  const [status, setStatus] = useState("idle"); // idle | loading | error
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const listRef = useRef(null);

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      const res = await fetch("/api/guestbook");
      if (!res.ok) throw new Error("request failed");
      const data = await res.json();
      setEntries(data.entries ?? []);
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  }, []);

  // fetched when first opened rather than on page load, so a visitor who never
  // opens it costs the API nothing
  const loadedRef = useRef(false);
  useEffect(() => {
    if (active && !loadedRef.current) {
      loadedRef.current = true;
      load();
    }
  }, [active, load]);

  const submit = async (e) => {
    e.preventDefault();
    const trimmed = message.trim();
    if (!trimmed || sending) return;

    setSending(true);
    setError("");
    try {
      const res = await fetch("/api/guestbook", {
        method: "POST",
        headers: { "content-type": "application/json" },
        // `website` is the honeypot: left empty by anyone using the real form
        body: JSON.stringify({ name: name.trim(), message: trimmed, website: "" }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error ?? "something went wrong, try again");
        return;
      }
      if (data.entry) setEntries((prev) => [data.entry, ...prev]);
      setMessage("");
      listRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setError("could not reach the server");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="guestbook-body">
      <form onSubmit={submit} className="gb-form">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="your name (optional)"
          maxLength={40}
          className="gb-name"
        />
        <div className="gb-row">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="leave a note…"
            maxLength={MESSAGE_MAX}
            rows={2}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit(e);
            }}
          />
          <button type="submit" disabled={!message.trim() || sending} aria-label="Send">
            <Send className="size-4" />
          </button>
        </div>
        <div className="gb-meta">
          <span>{error || "⌘↵ to send"}</span>
          <span>
            {message.length}/{MESSAGE_MAX}
          </span>
        </div>
      </form>

      <div className="gb-list" ref={listRef}>
        {status === "loading" && <p className="gb-empty">loading…</p>}
        {status === "error" && (
          <p className="gb-empty">
            couldn&apos;t load the guestbook.{" "}
            <button type="button" onClick={load} className="underline">
              retry
            </button>
          </p>
        )}
        {status === "idle" && entries.length === 0 && (
          <p className="gb-empty">no notes yet. be the first.</p>
        )}
        {entries.map((entry) => (
          <article key={entry.id} className="gb-entry">
            <header>
              <strong>{entry.name}</strong>
              <time dateTime={entry.createdAt}>
                {dayjs(entry.createdAt).format("MMM D, YYYY")}
              </time>
            </header>
            {/* rendered as text, never HTML */}
            <p>{entry.message}</p>
          </article>
        ))}
      </div>
    </div>
  );
};

const Guestbook = () => {
  const isOpen = useWindowStore((state) => state.windows.guestbook.isOpen);
  return (
    <>
      <div id="window-header">
        <WindowControls target="guestbook" />
        <h2>Guestbook</h2>
      </div>
      <GuestbookBody active={isOpen} />
    </>
  );
};

const GuestbookWindow = WindowWrapper(Guestbook, "guestbook", { min: { w: 360, h: 320 } });

export default GuestbookWindow;
