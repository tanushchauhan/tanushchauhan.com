import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import clsx from "clsx";
import WindowWrapper from "#hoc/WindowWrapper.jsx";
import { WindowControls } from "#components";
import AppIcon from "#components/AppIcon.jsx";
import { locations, parentOf } from "#constants";
import useWindowStore, { FINDER_KEYS } from "#store/window.js";
import { openFile } from "../utils/files.js";

const Finder = ({ windowKey }) => {
  const { windows, openWindow, quickLook, setQuickLook } = useWindowStore();
  // each Finder window carries its own location in its window data
  const activeLocation = windows[windowKey].data ?? locations.work;

  // Visits made in this window. When there is nothing to go back to, Back
  // climbs to the enclosing folder instead, so a project opened from the
  // desktop can still reach the list it came from.
  const [history, setHistory] = useState({ back: [], forward: [] });
  const isOpen = windows[windowKey].isOpen;
  useEffect(() => {
    if (!isOpen) setHistory({ back: [], forward: [] });
  }, [isOpen]);
  const backTo = history.back.at(-1) ?? parentOf(activeLocation.id);
  const forwardTo = history.forward.at(-1);

  const navigateTo = (item) => {
    if (item.id === activeLocation.id) return;
    setHistory((h) => ({ back: [...h.back, activeLocation], forward: [] }));
    openWindow(windowKey, item);
  };

  const goBack = () => {
    if (!backTo) return;
    setHistory((h) => ({
      back: h.back.slice(0, -1),
      forward: [...h.forward, activeLocation],
    }));
    openWindow(windowKey, backTo);
  };

  const goForward = () => {
    if (!forwardTo) return;
    setHistory((h) => ({
      back: [...h.back, activeLocation],
      forward: h.forward.slice(0, -1),
    }));
    openWindow(windowKey, forwardTo);
  };

  const openItem = (item) => {
    if (item.kind === "folder") return navigateTo(item);
    openFile(item, openWindow);
  };

  /*
   * Selection, the way Finder does it: a click selects, a double-click opens,
   * and Space shows the selection in Quick Look. The selection is an id rather
   * than an index so it survives the folder's contents being re-rendered, and
   * it is dropped whenever the window moves to another folder.
   */
  const items = activeLocation.children ?? [];
  const [selectedId, setSelectedId] = useState(null);
  const selected = items.find((item) => item.id === selectedId) ?? null;
  useEffect(() => setSelectedId(null), [activeLocation.id]);

  // Only the frontmost window listens to the keyboard, as on a Mac. Two open
  // Finders would otherwise both answer a Space.
  const isFront =
    isOpen &&
    !windows[windowKey].isMinimized &&
    Object.values(windows).every(
      (w) => !w.isOpen || w.isMinimized || w.zIndex <= windows[windowKey].zIndex
    );
  const previewing = quickLook?.windowKey === windowKey;
  // a preview outlives nothing: closing or leaving the folder takes it down
  useEffect(() => {
    if (useWindowStore.getState().quickLook?.windowKey === windowKey) setQuickLook(null);
  }, [isOpen, activeLocation.id, windowKey, setQuickLook]);

  useEffect(() => {
    if (!isFront) return;
    const onKey = (e) => {
      // typing somewhere is typing, not a shortcut
      if (e.target.closest?.("input, textarea, [contenteditable]")) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === " " && selected) {
        e.preventDefault();
        if (previewing) return setQuickLook(null);
        // where the icon is, so the panel can zoom out of it
        const icon = document.querySelector(`#${windowKey} ul.content li.selected :is(.app-icon, img)`);
        const r = icon?.getBoundingClientRect();
        setQuickLook({
          item: selected,
          windowKey,
          origin: r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null,
        });
        return;
      }
      if (e.key === "Enter" && selected) {
        e.preventDefault();
        setQuickLook(null);
        openItem(selected);
        return;
      }
      // arrows walk the items in order; with Quick Look open the preview
      // follows, which is how you flick through a folder on a Mac
      const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
      if (step && items.length) {
        e.preventDefault();
        const at = items.findIndex((item) => item.id === selectedId);
        const next =
          items[at === -1 ? (step > 0 ? 0 : items.length - 1) : (at + step + items.length) % items.length];
        setSelectedId(next.id);
        if (previewing) setQuickLook({ item: next, windowKey });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const renderList = (name, items) => (
    <div>
      <h3>{name}</h3>
      <ul>
        {items.map((item) => (
          <li
            key={item.id}
            className={clsx(
              item.id === activeLocation.id ? "active" : "not-active"
            )}
            onClick={() => navigateTo(item)}
          >
            <AppIcon icon={item.icon} className="w-4" alt={item.name} />
            <p>{item.name}</p>
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <>
      <div id="window-header">
        <WindowControls target={windowKey} />
        <div className="finder-nav">
          <button type="button" aria-label="Back" disabled={!backTo} onClick={goBack}>
            <ChevronLeft />
          </button>
          <button type="button" aria-label="Forward" disabled={!forwardTo} onClick={goForward}>
            <ChevronRight />
          </button>
        </div>
        <h2>{activeLocation.name}</h2>
        <Search className="icon ml-auto" />
      </div>

      <div className="finder-body">
        <div className="sidebar">
          {renderList("Favorites", Object.values(locations))}
          {renderList("Projects", locations.work.children)}
        </div>

        <div className="finder-main">
          {/* a click on empty space clears the selection, as it does in Finder */}
          <ul className="content" onClick={(e) => e.target === e.currentTarget && setSelectedId(null)}>
            {items.map((item) => (
              <li
                key={item.id}
                className={clsx(item.position, item.id === selectedId && "selected")}
                onClick={() => {
                  setSelectedId(item.id);
                  // Quick Look open on something else follows the click
                  if (previewing) setQuickLook({ item, windowKey });
                }}
                onDoubleClick={() => {
                  setQuickLook(null);
                  openItem(item);
                }}
              >
                <AppIcon
                  icon={item.icon}
                  alt={item.name}
                  className={clsx(item.kind === "link" && "link-chip")}
                />
                <p>{item.name}</p>
              </li>
            ))}
          </ul>

          {/* The status bar Finder has at the foot of a window. It also carries
              the two shortcuts, because a click that selects instead of opens
              is a Mac habit a visitor may not share. */}
          <p className="finder-status">
            {selected ? (
              <>
                <b>{selected.name}</b> selected · double-click to open · Space to preview
              </>
            ) : (
              `${items.length} item${items.length === 1 ? "" : "s"}`
            )}
          </p>
        </div>
      </div>
    </>
  );
};

const FinderWindows = FINDER_KEYS.map((key) => {
  const Bound = (props) => <Finder {...props} windowKey={key} />;
  Bound.displayName = `Finder(${key})`;
  return WindowWrapper(Bound, key, { min: { w: 520, h: 320 } });
});

export default FinderWindows;
