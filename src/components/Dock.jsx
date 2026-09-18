import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { Tooltip } from "react-tooltip";
import clsx from "clsx";
import { dockApps } from "#constants";
import useWindowStore, { FINDER_KEYS } from "#store/window.js";
import { locations } from "#constants";
import AppIcon from "./AppIcon.jsx";

const MIN_WINDOW_META = {
  finder: { icon: "finder", name: "Projects" },
  finder2: { icon: "finder", name: "Projects" },
  finder3: { icon: "finder", name: "Projects" },
  safari: { icon: "safari", name: "Highlights" },
  photos: { icon: "photos", name: "Gallery" },
  terminal: { icon: "terminal", name: "Terminal" },
  contact: { icon: "contact", name: "Contact" },
  guestbook: { icon: "guestbook", name: "Guestbook" },
  txtFile: { icon: "txt", name: "Text" },
  imgFile: { icon: "image", name: "Image" },
  about: { icon: "/images/avatar-tanush.svg", name: "About This Mac" },
};

const Dock = () => {
  const dockRef = useRef(null);
  const { windows, openWindow, closeWindow, restoreWindow, openFinderWindow } =
    useWindowStore();

  const minimized = Object.entries(windows).filter(
    ([, win]) => win.isOpen && win.isMinimized
  );

  const toggleApp = (app) => {
    if (!app.canOpen) return;

    // Trash is a Finder shortcut straight into the junk drawer.
    if (app.id === "trash") return openFinderWindow(locations.trash);

    if (app.id === "finder") {
      const minimizedKey = FINDER_KEYS.find(
        (k) => windows[k].isOpen && windows[k].isMinimized
      );
      if (minimizedKey) return restoreWindow(minimizedKey);
      if (FINDER_KEYS.some((k) => windows[k].isOpen))
        return FINDER_KEYS.forEach((k) => windows[k].isOpen && closeWindow(k));
      return openFinderWindow(locations.work);
    }

    const win = windows[app.id];
    if (!win) return;

    if (win.isOpen && win.isMinimized) restoreWindow(app.id);
    else if (win.isOpen) closeWindow(app.id);
    else openWindow(app.id);
  };

  useGSAP(() => {
    const dock = dockRef.current;
    if (!dock) return;

    // queried per event so minimized tiles added later also magnify
    const animateIcons = (mouseX) => {
      const { left } = dock.getBoundingClientRect();

      dock.querySelectorAll(".dock-icon").forEach((icon) => {
        const { left: iconLeft, width } = icon.getBoundingClientRect();
        const center = iconLeft - left + width / 2;
        const distance = Math.abs(mouseX - center);
        const intensity = Math.exp(-(distance ** 2.5) / 20000);

        gsap.to(icon, {
          scale: 1 + 0.25 * intensity,
          y: -15 * intensity,
          duration: 0.2,
          ease: "power1.out",
        });
      });
    };

    const handleMouseMove = (e) => {
      const { left } = dock.getBoundingClientRect();
      animateIcons(e.clientX - left);
    };

    const resetIcons = () => {
      dock.querySelectorAll(".dock-icon").forEach((icon) =>
        gsap.to(icon, { scale: 1, y: 0, duration: 0.3, ease: "power1.out" })
      );
    };

    dock.addEventListener("mousemove", handleMouseMove);
    dock.addEventListener("mouseleave", resetIcons);

    return () => {
      dock.removeEventListener("mousemove", handleMouseMove);
      dock.removeEventListener("mouseleave", resetIcons);
    };
  }, []);

  return (
    <section id="dock">
      <div ref={dockRef} className="dock-container">
        {dockApps.map((app, i) => (
          // the slot takes the click, not the button: the button rises as it
          // magnifies, and a pointer resting where it was should still open it
          <div key={app.id} className="dock-slot" onClick={() => toggleApp(app)}>
            {i === dockApps.length - 1 && <span className="dock-divider" />}
            <button
              type="button"
              className="dock-icon"
              aria-label={app.name}
              data-tooltip-id="dock-tooltip"
              data-tooltip-content={app.name}
              data-tooltip-delay-show={150}
              disabled={!app.canOpen}
            >
              <AppIcon
                icon={app.id === "trash" && locations.trash.children.length ? "trash-full" : app.icon}
                alt={app.name} className={clsx(!app.canOpen && "opacity-60")} />
            </button>
            {(app.id === "finder"
              ? FINDER_KEYS.some((k) => windows[k].isOpen)
              : windows[app.id]?.isOpen) && <span className="running-dot" />}
          </div>
        ))}

        {minimized.length > 0 && <span className="dock-divider" />}
        {minimized.map(([key, win]) => {
          const meta = MIN_WINDOW_META[key] ?? { icon: "txt", name: key };
          const name = win.data?.name ?? meta.name;
          return (
            <div key={key} className="dock-slot" onClick={() => restoreWindow(key)}>
              <button
                type="button"
                className="dock-icon min-tile"
                data-min-tile={key}
                aria-label={`Restore ${name}`}
                data-tooltip-id="dock-tooltip"
                data-tooltip-content={name}
                data-tooltip-delay-show={150}
              >
                <span className="mini-bar">
                  <i />
                  <i />
                  <i />
                </span>
                <AppIcon icon={meta.icon} alt={name} />
              </button>
            </div>
          );
        })}

        <Tooltip id="dock-tooltip" place="top" className="tooltip" />
      </div>
    </section>
  );
};

export default Dock;
