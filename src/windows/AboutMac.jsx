import { useEffect, useState } from "react";
import dayjs from "dayjs";
import WindowWrapper from "#hoc/WindowWrapper.jsx";
import { WindowControls } from "#components";
import { locations, wallpaperFor } from "#constants";
import useWindowStore from "#store/window.js";
import { registerVisit } from "../utils/visit.js";
import { useAppearance } from "../utils/appearance.js";

const BUILD = __BUILD__;

const duration = (seconds) => {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d) return `${d}d ${h}h`;
  if (h) return `${h}h ${m}m`;
  return `${Math.max(1, m)}m`;
};

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

const REPO = "https://github.com/tanushchauhan/tanushchauhan.com";

/** The commit this build came from, linked to it on GitHub. */
const Build = () => {
  const date = dayjs(BUILD.builtAt).format("MMM D, YYYY");
  if (!BUILD.commit) return date;
  return (
    <>
      <a href={`${REPO}/commit/${BUILD.commit}`} target="_blank" rel="noreferrer">
        {BUILD.commit}
      </a>
      {` · ${date}`}
    </>
  );
};

const AboutMac = () => {
  const { openWindow, windows } = useWindowStore();
  const { health, visitors } = useLiveSpecs(windows.about?.isOpen);
  const { dark, wallpaper } = useAppearance();

  const openAboutMe = () => {
    const aboutTxt = locations.about.children.find((c) => c.id === "about-me");
    openWindow("txtFile", aboutTxt.data);
  };

  const specs = [
    ["Chip", `React ${BUILD.react} on Vite ${BUILD.vite}`],
    ["Server", "Bun, Hono and Postgres"],
    health && ["Uptime", `${duration(health.uptimeSeconds)} since the last deploy`],
    ["Build", <Build key="build" />],
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
