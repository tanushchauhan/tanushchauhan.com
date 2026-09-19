import { useEffect, useRef } from "react";
import { Sun, Moon, MonitorCog, Volume2, VolumeX, Check } from "lucide-react";
import clsx from "clsx";
import { wallpapers } from "#constants";
import useWindowStore from "#store/window.js";

const THEMES = [
  { value: "auto", label: "Auto", icon: MonitorCog },
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
];

const GLASS = [
  { value: "clear", label: "Clear", chip: 0.24 },
  { value: "regular", label: "Regular", chip: 0.5 },
  { value: "tinted", label: "Tinted", chip: 0.84 },
];

const ControlCenter = () => {
  const {
    controlCenterOpen,
    setControlCenter,
    theme,
    setTheme,
    glass,
    setGlass,
    wallpaper,
    setWallpaper,
    soundOn,
    toggleSound,
  } = useWindowStore();
  const ref = useRef(null);

  useEffect(() => {
    if (!controlCenterOpen) return;
    const onDown = (e) => {
      // the trigger toggles the panel itself
      if (ref.current?.contains(e.target) || e.target.closest("#control-center-button")) {
        return;
      }
      setControlCenter(false);
    };
    const onKey = (e) => e.key === "Escape" && setControlCenter(false);

    // pointerdown in the capture phase: GSAP draggables suppress mouse events
    window.addEventListener("pointerdown", onDown, true);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("keydown", onKey);
    };
  }, [controlCenterOpen, setControlCenter]);

  if (!controlCenterOpen) return null;

  return (
    <div className="control-center" ref={ref} role="dialog" aria-label="Control Center">
      <section className="cc-tile">
        <p className="cc-label">Appearance</p>
        <div className="cc-segmented">
          {THEMES.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              className={clsx(theme === value && "on")}
              aria-pressed={theme === value}
              onClick={() => setTheme(value)}
            >
              <Icon className="size-4" />
              <span>{label}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="cc-tile">
        <p className="cc-label">Liquid Glass</p>
        <div className="cc-glass">
          {GLASS.map(({ value, label, chip }) => (
            <button
              key={value}
              type="button"
              className={clsx(glass === value && "on")}
              aria-pressed={glass === value}
              onClick={() => setGlass(value)}
            >
              <span className="chip" style={{ "--chip": chip }} aria-hidden="true" />
              <span>{label}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="cc-tile">
        <p className="cc-label">Wallpaper</p>
        <div className="cc-papers">
          {wallpapers.map((paper) => (
            <button
              key={paper.id}
              type="button"
              className={clsx("cc-paper", wallpaper === paper.id && "on")}
              aria-pressed={wallpaper === paper.id}
              title={paper.note}
              onClick={() => setWallpaper(paper.id)}
            >
              <span className="swatch">
                <img src={paper.light} alt="" />
                <img src={paper.dark} alt="" />
                {wallpaper === paper.id && <Check className="tick size-3.5" />}
              </span>
              <span className="name">{paper.name}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="cc-tile">
        <button type="button" className="cc-row" onClick={toggleSound} aria-pressed={soundOn}>
          {soundOn ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
          <span className="cc-label">Sound effects</span>
          <span className={clsx("cc-switch", soundOn && "on")} aria-hidden="true">
            <span />
          </span>
        </button>
      </section>
    </div>
  );
};

export default ControlCenter;
