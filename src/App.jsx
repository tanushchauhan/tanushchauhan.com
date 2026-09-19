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
  QuickLook,
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

  useEffect(() => {
    useAuthStore.getState().refresh();
    registerVisit();
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

  // every wallpaper is a light/dark pair, so theme and wallpaper resolve together
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
        <QuickLook />
        <DesktopMenu />
        <Dock />
      </main>
    </>
  );
};

export default App;
