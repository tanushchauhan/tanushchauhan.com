import { useSyncExternalStore } from "react";
import useWindowStore from "#store/window.js";
import { APPEARANCE_DEFAULTS } from "#constants";

const query = "(prefers-color-scheme: dark)";

const subscribe = (onChange) => {
  const media = window.matchMedia(query);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
};

/**
 * Theme, wallpaper and glass as they resolve right now. A wallpaper or glass
 * level the visitor has not chosen follows the appearance, so light and dark
 * each open on what suits them.
 */
export const useAppearance = () => {
  const theme = useWindowStore((s) => s.theme);
  const wallpaper = useWindowStore((s) => s.wallpaper);
  const glass = useWindowStore((s) => s.glass);

  const systemDark = useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false
  );

  const dark = theme === "dark" || (theme === "auto" && systemDark);
  const fallback = APPEARANCE_DEFAULTS[dark ? "dark" : "light"];

  return {
    dark,
    wallpaper: wallpaper ?? fallback.wallpaper,
    glass: glass ?? fallback.glass,
  };
};
