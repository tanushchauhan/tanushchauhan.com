import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import clsx from "clsx";
import WindowWrapper from "#hoc/WindowWrapper.jsx";
import { WindowControls } from "#components";
import AppIcon from "#components/AppIcon.jsx";
import { locations, parentOf } from "#constants";
import useWindowStore, { FINDER_KEYS } from "#store/window.js";

const Finder = ({ windowKey }) => {
  const { windows, openWindow } = useWindowStore();
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

    if (["fig", "url"].includes(item.fileType) && item.href)
      return window.open(item.href, "_blank", "noopener,noreferrer");

    openWindow(`${item.fileType}File`, item.data);
  };

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

        <ul className="content">
          {activeLocation.children?.map((item) => (
            <li
              key={item.id}
              className={item.position}
              onClick={() => openItem(item)}
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
