import { useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { locations } from "#constants";
import useWindowStore from "#store/window.js";

const APP_ENTRIES = [
  { title: "Projects", subtitle: "Finder", icon: "/images/finder.png", app: "finder" },
  { title: "Highlights", subtitle: "Safari", icon: "/images/safari.png", app: "safari" },
  { title: "Gallery", subtitle: "Photos", icon: "/images/photos.png", app: "photos" },
  { title: "Terminal", subtitle: "run some commands", icon: "/images/terminal.png", app: "terminal" },
  { title: "Contact", subtitle: "get in touch", icon: "/images/contact.png", app: "contact" },
  { title: "Guestbook", subtitle: "leave a note", icon: "/images/guestbook.svg", app: "guestbook" },
  { title: "Publications", subtitle: "the papers", icon: "/icons/file.svg", location: "publications" },
  { title: "About This Mac", subtitle: "system info", icon: "/images/avatar-tanush.svg", app: "about" },
];

const Spotlight = () => {
  const { spotlightOpen, setSpotlight, openWindow, openFinderWindow } =
    useWindowStore();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const inputRef = useRef(null);

  // apps + every folder and file the Finder knows about
  const index = useMemo(() => {
    const entries = APP_ENTRIES.map((e) => ({
      ...e,
      kind: "Applications",
      run: () => {
        if (e.app === "finder") return openFinderWindow(locations.work);
        if (e.location) return openFinderWindow(locations[e.location]);
        openWindow(e.app);
      },
    }));

    const addItem = (item, parentName) => {
      if (item.kind === "folder") {
        entries.push({
          title: item.name,
          subtitle: parentName ? `${parentName} · folder` : "folder",
          icon: item.icon,
          kind: "Folders",
          run: () => openFinderWindow(item),
        });
        item.children?.forEach((c) => addItem(c, item.name));
        return;
      }
      entries.push({
        title: item.name,
        subtitle: parentName ?? "",
        icon: item.icon,
        chip: item.kind === "link",
        kind: "Files",
        run: () => {
          if (["fig", "url"].includes(item.fileType) && item.href)
            return window.open(item.href, "_blank", "noopener,noreferrer");
          openWindow(`${item.fileType}File`, item.data);
        },
      });
    };
    Object.values(locations).forEach((loc) => addItem(loc, null));
    return entries;
  }, [openWindow, openFinderWindow]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const scored = index
      .map((e) => {
        const title = e.title.toLowerCase();
        const sub = e.subtitle.toLowerCase();
        let score = -1;
        if (title.startsWith(q)) score = 0;
        else if (title.includes(q)) score = 1;
        else if (sub.includes(q)) score = 2;
        return { ...e, score };
      })
      .filter((e) => e.score >= 0)
      .sort((a, b) => a.score - b.score);
    return scored.slice(0, 8);
  }, [query, index]);

  const close = () => {
    setSpotlight(false);
    setQuery("");
    setSelected(0);
  };

  const run = (entry) => {
    close();
    entry.run();
  };

  // global shortcut: ⌘K / Ctrl+K
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSpotlight(!useWindowStore.getState().spotlightOpen);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setSpotlight]);

  useEffect(() => {
    if (spotlightOpen) inputRef.current?.focus();
  }, [spotlightOpen]);

  useEffect(() => setSelected(0), [query]);

  if (!spotlightOpen) return null;

  const handleKeyDown = (e) => {
    if (e.key === "Escape") return close();
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelected((s) => Math.min(s + 1, results.length - 1));
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelected((s) => Math.max(s - 1, 0));
    }
    if (e.key === "Enter" && results[selected]) run(results[selected]);
  };

  return (
    <div id="spotlight" onMouseDown={close}>
      <div className="panel" onMouseDown={(e) => e.stopPropagation()}>
        <div className="bar">
          <Search className="size-6 text-neutral-400" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Spotlight Search"
            spellCheck={false}
            aria-label="Spotlight search"
          />
          <kbd>esc</kbd>
        </div>

        {results.length > 0 && (
          <ul>
            {results.map((r, i) => (
              <li
                key={`${r.kind}-${r.title}-${i}`}
                className={i === selected ? "selected" : ""}
                onMouseEnter={() => setSelected(i)}
                onClick={() => run(r)}
              >
                <img src={r.icon} alt="" className={r.chip ? "chip" : ""} />
                <p className="title">{r.title}</p>
                <p className="sub">{r.subtitle}</p>
                <span className="kind">{r.kind}</span>
              </li>
            ))}
          </ul>
        )}
        {query && !results.length && (
          <p className="empty">No results for “{query}”</p>
        )}
      </div>
    </div>
  );
};

export default Spotlight;
