import { Search } from "lucide-react";
import clsx from "clsx";
import WindowWrapper from "#hoc/WindowWrapper.jsx";
import { WindowControls } from "#components";
import { locations } from "#constants";
import useWindowStore, { FINDER_KEYS } from "#store/window.js";

const Finder = ({ windowKey }) => {
  const { windows, openWindow } = useWindowStore();
  // each Finder window carries its own location in its window data
  const activeLocation = windows[windowKey].data ?? locations.work;

  const navigateTo = (item) => openWindow(windowKey, item);

  const openItem = (item) => {
    if (item.fileType === "pdf") return openWindow("resume");

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
            <img src={item.icon} className="w-4" alt={item.name} />
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
              <img
                src={item.icon}
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
  return WindowWrapper(Bound, key);
});

export default FinderWindows;
