import { useEffect, useState } from "react";
import dayjs from "dayjs";
import WindowWrapper from "#hoc/WindowWrapper.jsx";
import { WindowControls } from "#components";
import { locations, wallpaperFor } from "#constants";
import useWindowStore from "#store/window.js";
import { registerVisit } from "../utils/visit.js";

// set by vite.config.js at build time
const BUILD = __BUILD__;

const duration = (seconds) => {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d) return `${d}d ${h}h`;
  if (h) return `${h}h ${m}m`;
  return `${Math.max(1, m)}m`;
};

/*
 * What the machine is, and how it is doing right now. The spec sheet used to
 * put a GPA in the Memory slot and a scholarship in the Startup Disk, which is
 * a boast wearing a joke's clothes. Now every row is a fact about the site you
 * are looking at, and the ones that change are read when the window opens:
 * how long the server has been up since the last deploy, which build this is,
 * how many people have been here, and the display you are looking at it on.
 */
const useLiveSpecs = (isOpen) => {
  const [health, setHealth] = useState(null);
  const [visitors, setVisitors] = useState(null);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    const load = () =>
      fetch("/api/health")
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null)
        .then((body) => !cancelled && body && setHealth({ ...body, at: Date.now() }));

    load();
    registerVisit().then((visit) => !cancelled && visit && setVisitors(visit.total));
    const timer = setInterval(load, 30 * 1000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [isOpen]);

  return { health, visitors };
};

const AboutMac = () => {
  const { openWindow, windows, wallpaper, theme } = useWindowStore();
  const { health, visitors } = useLiveSpecs(windows.about?.isOpen);
  // read from the root rather than the setting, which can be "auto"; theme is
  // still read above so that changing it re-renders this
  const dark = theme && document.documentElement.classList.contains("dark");

  const openAboutMe = () => {
    const aboutTxt = locations.about.children.find((c) => c.id === "about-me");
    openWindow("txtFile", aboutTxt.data);
  };

  const specs = [
    ["Chip", `React ${BUILD.react} on Vite ${BUILD.vite}`],
    ["Server", "Bun, Hono and Postgres"],
    // a restart is a deploy here, so uptime doubles as "last deployed"
    health && ["Uptime", `${duration(health.uptimeSeconds)} since the last deploy`],
    [
      "Build",
      [BUILD.commit, dayjs(BUILD.builtAt).format("MMM D, YYYY")].filter(Boolean).join(" · "),
    ],
    visitors != null && ["Visitors", visitors.toLocaleString()],
    [
      "Display",
      `${window.screen.width}×${window.screen.height}${window.devicePixelRatio > 1 ? ` at ${window.devicePixelRatio}x` : ""}`,
    ],
    ["Serial Number", "TC-ATX-2026"],
  ].filter(Boolean);

  return (
    <>
      <div id="window-header">
        <WindowControls target="about" />
      </div>

      <div className="about-body">
        {/* the machine, drawn, with whatever wallpaper is on the desktop on
            its screen, the way a Mac shows you your own */}
        <div className="machine" aria-hidden="true">
          <div className="screen">
            <img src={wallpaperFor(wallpaper, dark)} alt="" />
            <span className="notch" />
          </div>
          <div className="base" />
        </div>

        <h3>tanushchauhan.com</h3>
        <p className="version">Portfolio, 2026 · Version 1.0</p>

        <dl>
          {specs.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>

        <button type="button" onClick={openAboutMe}>
          More Info…
        </button>

        <p className="fine-print">™ and © 2026 Tanush Chauhan.</p>
      </div>
    </>
  );
};

const AboutWindow = WindowWrapper(AboutMac, "about", { resizable: false });

export default AboutWindow;
