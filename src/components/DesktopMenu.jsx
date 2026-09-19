import { useEffect, useState } from "react";
import { FolderPlus, ImageIcon, LayoutGrid, Info } from "lucide-react";
import useWindowStore from "#store/window.js";

const DesktopMenu = () => {
  const [menu, setMenu] = useState(null);
  const { addDesktopFolder, resetFolderPos, setControlCenter, openWindow } =
    useWindowStore();

  useEffect(() => {
    const onContextMenu = (e) => {
      // desktop background only; windows, dock, and menu bar keep defaults
      if (!e.target.closest("main")) return;
      if (e.target.closest(".window, #dock, #spotlight")) return;
      e.preventDefault();
      setMenu({
        clickX: e.clientX,
        clickY: e.clientY,
        x: Math.min(e.clientX, window.innerWidth - 210),
        y: Math.min(e.clientY, window.innerHeight - 220),
      });
    };
    const onDown = (e) => {
      if (!e.target.closest(".desktop-menu")) setMenu(null);
    };
    const onKey = (e) => e.key === "Escape" && setMenu(null);

    document.addEventListener("contextmenu", onContextMenu);
    // pointerdown and capture, for the same reason as the Control Center: the
    // widgets are draggables, they preventDefault on pointerdown, and that
    // suppresses the mouse events a bubble-phase mousedown listener waits for.
    // This menu stayed open when you clicked one.
    window.addEventListener("pointerdown", onDown, true);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("contextmenu", onContextMenu);
      window.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  if (!menu) return null;

  // The menu is placed in viewport coordinates and folders in #home's, which
  // starts under the menu bar, so a folder used to land 64px below the click.
  // Centred on the pointer, the way a Mac drops a new folder where you asked.
  const newFolder = () => {
    const home = document.querySelector("#home")?.getBoundingClientRect();
    addDesktopFolder({
      x: Math.max(0, menu.clickX - (home?.left ?? 0) - 56),
      y: Math.max(0, menu.clickY - (home?.top ?? 0) - 40),
    });
  };

  const run = (action) => {
    action();
    setMenu(null);
  };

  return (
    <div className="desktop-menu" style={{ left: menu.x, top: menu.y }}>
      <button
        type="button"
        onClick={() => run(newFolder)}
      >
        <FolderPlus className="size-4" /> New Folder
      </button>
      <button type="button" onClick={() => run(resetFolderPos)}>
        <LayoutGrid className="size-4" /> Clean Up
      </button>
      {/* it opens the picker now. It used to flip the theme, which changed the
          wallpaper in the sense that the night version came up, and was the
          one item in this menu that did not do what it said. */}
      <button type="button" onClick={() => run(() => setControlCenter(true))}>
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
