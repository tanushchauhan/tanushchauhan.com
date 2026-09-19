import { useEffect, useState } from "react";
import { FolderPlus, ImageIcon, LayoutGrid, Info } from "lucide-react";
import useWindowStore from "#store/window.js";

const DesktopMenu = () => {
  const [menu, setMenu] = useState(null);
  const { addDesktopFolder, resetFolderPos, setControlCenter, openWindow } =
    useWindowStore();

  useEffect(() => {
    const onContextMenu = (e) => {
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
    // pointerdown in the capture phase, as in the Control Center
    window.addEventListener("pointerdown", onDown, true);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("contextmenu", onContextMenu);
      window.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  if (!menu) return null;

  // centred on the pointer, converted from viewport to #home coordinates
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
