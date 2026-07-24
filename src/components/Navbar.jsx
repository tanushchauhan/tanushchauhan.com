import { useEffect, useRef, useState } from "react";
import dayjs from "dayjs";
import { Sun, Moon, MonitorCog, Check, Volume2, VolumeX } from "lucide-react";
import clsx from "clsx";
import { navLinks, navIcons, locations } from "#constants";
import useWindowStore from "#store/window.js";

const THEME_OPTIONS = [
  { value: "auto", label: "Auto", icon: MonitorCog },
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
];

const Navbar = () => {
  const {
    openWindow,
    openFinderWindow,
    setSpotlight,
    theme,
    setTheme,
    soundOn,
    toggleSound,
  } = useWindowStore();
  const SoundIcon = soundOn ? Volume2 : VolumeX;
  const [now, setNow] = useState(dayjs());
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const themeMenuRef = useRef(null);

  useEffect(() => {
    const tick = setInterval(() => setNow(dayjs()), 30_000);
    return () => clearInterval(tick);
  }, []);

  // close the theme menu when clicking anywhere else
  useEffect(() => {
    if (!themeMenuOpen) return;
    const onDown = (e) => {
      if (!themeMenuRef.current?.contains(e.target)) setThemeMenuOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [themeMenuOpen]);

  const iconActions = {
    search: () => setSpotlight(true),
    mode: () => setThemeMenuOpen((open) => !open),
  };

  return (
    <nav>
      <div className="nav-left">
        <img
          src="/images/logo.svg"
          alt="About This Mac"
          className="h-4 cursor-pointer dark:invert"
          title="About This Mac"
          onClick={() => openWindow("about")}
        />
        <p className="text-sm font-bold dark:text-white">Tanush's Portfolio</p>
        <ul>
          {navLinks.map(({ id, name, type }) => (
            <li
              key={id}
              onClick={() =>
                type === "finder"
                  ? openFinderWindow(locations.work)
                  : openWindow(type)
              }
            >
              <p>{name}</p>
            </li>
          ))}
        </ul>
      </div>

      <div className="nav-right">
        <SoundIcon
          className="size-4 cursor-pointer text-black/70 opacity-70 transition-opacity hover:opacity-100 dark:text-white/80"
          onClick={toggleSound}
          aria-label={soundOn ? "Mute sounds" : "Enable sounds"}
        />
        <ul>
          {navIcons.map(({ id, img }) => {
            const action = Object.entries(iconActions).find(([name]) =>
              img.includes(name)
            )?.[1];
            const isThemeButton = img.includes("mode");
            return (
              <li key={id} className={clsx(isThemeButton && "relative")}>
                <img
                  src={img}
                  className="icon-hover"
                  alt={`icon-${id}`}
                  onClick={action}
                />
                {isThemeButton && themeMenuOpen && (
                  <div ref={themeMenuRef} className="theme-menu">
                    <p className="menu-title">Appearance</p>
                    {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
                      <button
                        key={value}
                        type="button"
                        className={clsx(theme === value && "active")}
                        onClick={() => {
                          setTheme(value);
                          setThemeMenuOpen(false);
                        }}
                      >
                        <Icon className="size-3.5" />
                        <span>{label}</span>
                        {theme === value && <Check className="ml-auto size-3.5" />}
                      </button>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        <time>{now.format("ddd MMM D h:mm A")}</time>
      </div>
    </nav>
  );
};

export default Navbar;
