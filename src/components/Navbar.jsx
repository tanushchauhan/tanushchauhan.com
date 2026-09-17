import { useEffect, useState } from "react";
import dayjs from "dayjs";
import { SlidersHorizontal } from "lucide-react";
import clsx from "clsx";
import { navLinks, navIcons, locations } from "#constants";
import useWindowStore from "#store/window.js";
import ControlCenter from "./ControlCenter.jsx";

const Navbar = () => {
  const {
    openWindow,
    openFinderWindow,
    setSpotlight,
    controlCenterOpen,
    setControlCenter,
  } = useWindowStore();
  const [now, setNow] = useState(dayjs());

  useEffect(() => {
    const tick = setInterval(() => setNow(dayjs()), 30_000);
    return () => clearInterval(tick);
  }, []);

  const iconActions = {
    search: () => setSpotlight(true),
  };

  return (
    <nav>
      <div className="nav-left">
        <img
          src="/images/logo.svg"
          alt="About This Mac"
          className="bar-glyph h-4 cursor-pointer"
          title="About This Mac"
          onClick={() => openWindow("about")}
        />
        <p className="text-sm font-bold">Tanush's Portfolio</p>
        <ul>
          {navLinks.map(({ id, name, type }) => (
            <li
              key={id}
              // a nav entry is either a Finder location or a window of its own
              onClick={() =>
                type === "finder"
                  ? openFinderWindow(locations.work)
                  : locations[type]
                    ? openFinderWindow(locations[type])
                    : openWindow(type)
              }
            >
              <p>{name}</p>
            </li>
          ))}
        </ul>
      </div>

      <div className="nav-right">
        <ul>
          {navIcons.map(({ id, img }) => {
            const action = Object.entries(iconActions).find(([name]) =>
              img.includes(name)
            )?.[1];
            return (
              <li key={id}>
                <img
                  src={img}
                  className="icon-hover bar-glyph"
                  alt={`icon-${id}`}
                  onClick={action}
                />
              </li>
            );
          })}
          <li className="relative">
            <button
              type="button"
              id="control-center-button"
              className={clsx("cc-trigger", controlCenterOpen && "on")}
              aria-label="Control Center"
              aria-expanded={controlCenterOpen}
              onClick={() => setControlCenter(!controlCenterOpen)}
            >
              <SlidersHorizontal className="size-4" />
            </button>
            <ControlCenter />
          </li>
        </ul>
        <time>{now.format("ddd MMM D h:mm A")}</time>
      </div>
    </nav>
  );
};

export default Navbar;
