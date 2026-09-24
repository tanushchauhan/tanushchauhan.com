import { useCallback, useEffect, useRef, useState } from "react";
import clsx from "clsx";
import dayjs from "dayjs";
import { Eye, EyeOff, Send, Trash2 } from "lucide-react";
import WindowWrapper from "#hoc/WindowWrapper.jsx";
import { WindowControls } from "#components";
import useWindowStore from "#store/window.js";
import useAuthStore from "#store/auth.js";

const MESSAGE_MAX = 500;

/** `active` triggers the first fetch; desktop windows stay mounted while hidden. */
export const GuestbookBody = ({ active = true }) => {
  const [entries, setEntries] = useState([]);
  const [status, setStatus] = useState("idle"); // idle | loading | error
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState(null);
  const listRef = useRef(null);
  const authed = useAuthStore((s) => s.status === "authed");

  // signed in the list includes hidden entries, so they can be brought back
  const load = useCallback(async () => {
    setStatus("loading");
    try {
      const res = await fetch(authed ? "/api/guestbook/all" : "/api/guestbook", {
        credentials: "same-origin",
      });
      if (!res.ok) throw new Error("request failed");
      const data = await res.json();
      setEntries(data.entries ?? []);
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  }, [authed]);

  const loadedRef = useRef(null);
  useEffect(() => {
    if (active && loadedRef.current !== authed) {
      loadedRef.current = authed;
      load();
    }
  }, [active, authed, load]);

  const moderate = async (entry, action) => {
    setError("");
    const url = `/api/guestbook/${entry.id}`;
    const options =
      action === "remove"
        ? { method: "DELETE" }
        : {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ hidden: !entry.isHidden }),
          };

    try {
      const res = await fetch(url, { ...options, credentials: "same-origin" });
      if (!res.ok) throw new Error();

      setEntries((prev) =>
        action === "remove"
          ? prev.filter((e) => e.id !== entry.id)
          : prev.map((e) => (e.id === entry.id ? { ...e, isHidden: !e.isHidden } : e))
      );
    } catch {
      setError(action === "remove" ? "could not delete that" : "could not change that");
    } finally {
      setConfirming(null);
    }
  };

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
        // `website` is the honeypot
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
          <article key={entry.id} className={clsx("gb-entry", entry.isHidden && "hidden-entry")}>
            <header>
              <strong>{entry.name}</strong>
              {entry.isHidden && <span className="gb-tag">hidden</span>}
              <time dateTime={entry.createdAt}>
                {dayjs(entry.createdAt).format("MMM D, YYYY")}
              </time>
              {authed && (
                <span className="gb-actions">
                  <button
                    type="button"
                    onClick={() => moderate(entry, "hide")}
                    title={entry.isHidden ? "Show" : "Hide"}
                    aria-label={entry.isHidden ? "Show" : "Hide"}
                  >
                    {entry.isHidden ? <Eye /> : <EyeOff />}
                  </button>
                  <button
                    type="button"
                    className={clsx("gb-delete", confirming === entry.id && "armed")}
                    onClick={() =>
                      confirming === entry.id
                        ? moderate(entry, "remove")
                        : setConfirming(entry.id)
                    }
                    onBlur={() => setConfirming((id) => (id === entry.id ? null : id))}
                    title="Delete"
                    aria-label={confirming === entry.id ? "Delete for good" : "Delete"}
                  >
                    {confirming === entry.id ? "sure?" : <Trash2 />}
                  </button>
                </span>
              )}
            </header>
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
