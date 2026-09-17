import { useEffect, useRef } from "react";
import { Sun, Moon, MonitorCog, Volume2, VolumeX, Check } from "lucide-react";
import clsx from "clsx";
import { wallpapers } from "#constants";
import useWindowStore from "#store/window.js";

/**
 * The Control Center.
 *
 * Everything here used to be scattered along the menu bar: appearance behind
 * its own dropdown, sound as a lone speaker icon, and a wallpaper item in the
 * desktop right-click menu that did not change the wallpaper. They are the
 * same kind of thing, they belong in the same panel, and the menu bar is
 * quieter for their leaving.
 *
 * Only controls that do something. macOS has Wi-Fi and Bluetooth and
 * brightness up here too, and a row of switches wired to nothing would be a
 * more convincing imitation and a worse thing to hand somebody.
 */
const THEMES = [
  { value: "auto", label: "Auto", icon: MonitorCog },
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
];

/* How much of the desktop shows through the chrome, the way the slider in
   macOS 27 runs from clear glass to fully tinted. The chip on each button is
   drawn at the opacity that choice gives the glass, so the row previews
   itself. */
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
      // the trigger closes it itself, so ignoring that click here stops the
      // two handlers from cancelling each other out into a panel that never opens
      if (ref.current?.contains(e.target) || e.target.closest("#control-center-button")) {
        return;
      }
      setControlCenter(false);
    };
    const onKey = (e) => e.key === "Escape" && setControlCenter(false);

    /* pointerdown, in the capture phase, and both halves matter.
     *
     * The widgets and the desktop folders are GSAP draggables, and a draggable
     * calls preventDefault on pointerdown, which suppresses the compatibility
     * mouse events entirely: a click on a widget fires no mousedown anywhere,
     * so a mousedown listener never hears about most of the desktop. Capture
     * then makes sure we run before anything can stop propagation. */
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
              {/* both halves of the pair, so the swatch shows what the theme
                  switch will do to it as well as what it looks like now */}
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
