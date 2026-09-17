import { useEffect, useState } from "react";
import {
  Navbar,
  Welcome,
  Dock,
  Home,
  Widgets,
  BootScreen,
  Spotlight,
  MobileExperience,
  DesktopMenu,
} from "#components";
import {
  Terminal,
  Safari,
  FinderWindows,
  Contact,
  Photos,
  Text,
  ImageViewer,
  AboutMac,
  Guestbook,
} from "#windows";
import useWindowStore from "#store/window.js";
import useAuthStore from "#store/auth.js";
import { setSoundEnabled } from "./utils/sound.js";
import { registerVisit } from "./utils/visit.js";
import { paleSky, wallpaperFor } from "#constants";

const MOBILE_QUERY = "(max-width: 767px)";

const App = () => {
  const theme = useWindowStore((state) => state.theme);
  const glass = useWindowStore((state) => state.glass);
  const wallpaper = useWindowStore((state) => state.wallpaper);
  const soundOn = useWindowStore((state) => state.soundOn);

  useEffect(() => {
    setSoundEnabled(soundOn);
  }, [soundOn]);

  // asked once per load, because the session lives in an httpOnly cookie that
  // the page cannot inspect for itself
  useEffect(() => {
    useAuthStore.getState().refresh();
    registerVisit(); // counted once per load, whatever the terminal asks later
  }, []);
  const [isMobile, setIsMobile] = useState(
    () => window.matchMedia(MOBILE_QUERY).matches
  );

  useEffect(() => {
    const media = window.matchMedia(MOBILE_QUERY);
    const onChange = () => setIsMobile(media.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  // theme and wallpaper together, because the wallpaper depends on which one
  // won: every wallpaper is a light/dark pair, and this is the only place that
  // knows whether "auto" resolved to dark on this device right now. The menu
  // bar is transparent, so its ink is picked here too, from whether the
  // resolved wallpaper is pale at the top.
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const dark = theme === "dark" || (theme === "auto" && media.matches);
      const root = document.documentElement;
      root.classList.toggle("dark", dark);
      root.dataset.glass = glass;
      root.dataset.bar = paleSky(wallpaper, dark) ? "dark" : "light";
      root.style.setProperty("--wallpaper", `url("${wallpaperFor(wallpaper, dark)}")`);
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [theme, glass, wallpaper]);

  if (isMobile) {
    return (
      <>
        <BootScreen />
        <MobileExperience />
      </>
    );
  }

  return (
    <>
      <BootScreen />
      <Navbar />
      <main>
        <Welcome />
        <Widgets />
        <Home />

        {FinderWindows.map((FinderWindow, i) => (
          <FinderWindow key={i} />
        ))}
        <Safari />
        <Photos />
        <Terminal />
        <Contact />
        <Guestbook />
        <Text />
        <ImageViewer />
        <AboutMac />

        <Spotlight />
        <DesktopMenu />
        <Dock />
      </main>
    </>
  );
};

export default App;
