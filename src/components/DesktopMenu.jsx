import { useEffect, useState } from "react";
import { FolderPlus, ImageIcon, LayoutGrid, Info } from "lucide-react";
import useWindowStore from "#store/window.js";

const DesktopMenu = () => {
  const [menu, setMenu] = useState(null);
  const { addDesktopFolder, resetFolderPos, setTheme, openWindow } =
    useWindowStore();

  useEffect(() => {
    const onContextMenu = (e) => {
      // desktop background only; windows, dock, and menu bar keep defaults
      if (!e.target.closest("main")) return;
      if (e.target.closest(".window, #dock, #spotlight")) return;
      e.preventDefault();
      setMenu({
        x: Math.min(e.clientX, window.innerWidth - 210),
        y: Math.min(e.clientY, window.innerHeight - 220),
      });
    };
    const onDown = (e) => {
      if (!e.target.closest(".desktop-menu")) setMenu(null);
    };
    const onKey = (e) => e.key === "Escape" && setMenu(null);

    document.addEventListener("contextmenu", onContextMenu);
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("contextmenu", onContextMenu);
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  if (!menu) return null;

  const run = (action) => {
    action();
    setMenu(null);
  };

  const isDark = document.documentElement.classList.contains("dark");

  return (
    <div className="desktop-menu" style={{ left: menu.x, top: menu.y }}>
      <button
        type="button"
        onClick={() => run(() => addDesktopFolder({ x: menu.x, y: menu.y }))}
      >
        <FolderPlus className="size-4" /> New Folder
      </button>
      <button type="button" onClick={() => run(resetFolderPos)}>
        <LayoutGrid className="size-4" /> Clean Up
      </button>
      <button
        type="button"
        onClick={() => run(() => setTheme(isDark ? "light" : "dark"))}
      >
        <ImageIcon className="size-4" /> Change Wallpaper
      </button>
      <hr />
      <button type="button" onClick={() => run(() => openWindow("about"))}>
        <Info className="size-4" /> About This Mac
      </button>
    </div>
  );
};

export default DesktopMenu;
