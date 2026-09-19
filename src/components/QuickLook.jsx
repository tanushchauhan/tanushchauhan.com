import { useEffect } from "react";
import { ExternalLink, X } from "lucide-react";
import useWindowStore from "#store/window.js";
import AppIcon from "./AppIcon.jsx";
import { openFile } from "../utils/files.js";

/*
 * Quick Look: a glance at the selected item without opening a window for it.
 * A floating panel over everything, the way the Mac shows one, holding the
 * file itself rather than a thumbnail: the text of a text file, the picture of
 * a picture, where a link goes, and what is inside a folder.
 *
 * Space and Escape close it; those keys belong to Finder, which also moves the
 * preview along when the arrows move the selection.
 */
const Preview = ({ item }) => {
  if (item.kind === "folder") {
    const children = item.children ?? [];
    return (
      <div className="ql-folder">
        <AppIcon icon="folder" />
        <p className="ql-count">
          {children.length} item{children.length === 1 ? "" : "s"}
        </p>
        <ul>
          {children.map((child) => (
            <li key={child.id}>
              <AppIcon icon={child.icon} className={child.kind === "link" ? "link-chip" : undefined} />
              {child.name}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (item.fileType === "img") {
    return <img className="ql-image" src={item.data?.imageUrl} alt={item.name} />;
  }

  if (item.fileType === "txt") {
    const { subtitle, image, portrait, description = [] } = item.data ?? {};
    return (
      <div className="ql-text">
        {subtitle && <p className="subtitle">{subtitle}</p>}
        {image && <img src={image} alt="" className={portrait ? "portrait" : "banner"} />}
        {description.map((paragraph, i) => (
          <p key={i}>{paragraph}</p>
        ))}
      </div>
    );
  }

  // a link: where it goes, which is the thing you want to know before a new tab
  return (
    <div className="ql-link">
      <AppIcon icon={item.icon} className="link-chip" />
      <p className="host">{item.name}</p>
      <p className="href">{item.href}</p>
    </div>
  );
};

const QuickLook = () => {
  const { quickLook, setQuickLook, openWindow } = useWindowStore();
  const item = quickLook?.item;

  useEffect(() => {
    if (!item) return;
    const onKey = (e) => e.key === "Escape" && setQuickLook(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [item, setQuickLook]);

  if (!item) return null;

  const open = () => {
    setQuickLook(null);
    if (item.kind === "folder") openWindow(quickLook.windowKey, item);
    else openFile(item, openWindow);
  };

  const openLabel =
    item.kind === "folder"
      ? "Open"
      : item.fileType === "url"
        ? "Open in New Tab"
        : item.fileType === "img"
          ? "Open with Preview"
          : "Open with TextEdit";

  // The panel zooms out of the icon it previews, as it does on a Mac: the
  // animation starts it at the icon's position, measured from the centre of
  // the screen where the panel comes to rest. Without an icon it grows in
  // place. Moving through a folder with the arrows keeps the same panel, so
  // this only plays when it opens.
  const origin = quickLook.origin;
  const from = origin
    ? {
        "--ql-from-x": `${Math.round(origin.x - window.innerWidth / 2)}px`,
        "--ql-from-y": `${Math.round(origin.y - window.innerHeight / 2)}px`,
      }
    : undefined;

  return (
    <div id="quick-look" role="dialog" aria-label={`Quick Look: ${item.name}`} style={from}>
      <header>
        <button type="button" className="ql-close" aria-label="Close" onClick={() => setQuickLook(null)}>
          <X />
        </button>
        <h2>{item.name}</h2>
        <button type="button" className="ql-open" onClick={open}>
          {item.fileType === "url" && <ExternalLink />}
          {openLabel}
        </button>
      </header>
      <div className="ql-body">
        <Preview item={item} />
      </div>
    </div>
  );
};

export default QuickLook;
