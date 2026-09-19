import { useEffect, useRef } from "react";
import gsap from "gsap";
import { Draggable } from "gsap/Draggable";
import { useGSAP } from "@gsap/react";
import clsx from "clsx";
import { locations } from "#constants";
import useWindowStore from "#store/window.js";
import AppIcon from "./AppIcon.jsx";

gsap.registerPlugin(Draggable);

const Home = () => {
  const projects = locations.work?.children ?? [];
  const {
    openFinderWindow,
    setFolderPos,
    folderPos,
    desktopFolders,
    cleanUps,
    placeDesktopFolders,
  } = useWindowStore();
  const homeRef = useRef(null);

  const openUserFolder = (folder) =>
    openFinderWindow({
      id: folder.id,
      name: folder.name,
      icon: "folder",
      kind: "folder",
      children: [],
    });

  useGSAP(() => {
    const saved = useWindowStore.getState().folderPos;
    document.querySelectorAll("#home .folder").forEach((el) => {
      const p = saved[el.dataset.id];
      if (p) gsap.set(el, { x: p.x, y: p.y });
    });

    const instances = Draggable.create(".folder", {
      bounds: "main",
      onDragEnd() {
        setFolderPos(this.target.dataset.id, { x: this.x, y: this.y });
      },
    });
    return () => instances.forEach((instance) => instance.kill());
  }, [desktopFolders.length]);

  // Clean Up: snap every icon home
  useEffect(() => {
    if (Object.keys(folderPos).length === 0)
      gsap.to("#home .folder", { x: 0, y: 0, duration: 0.3, ease: "power2.out" });
  }, [folderPos]);

  // Clean Up also moves new folders into free cells of the project grid,
  // column by column from the right
  useEffect(() => {
    const home = homeRef.current;
    if (!cleanUps || !home || !desktopFolders.length) return;

    const projectsEls = [...home.querySelectorAll("li.folder[data-project]")];
    if (!projectsEls.length) return;
    // offsetLeft ignores transforms, so this is the home grid mid-animation
    const lefts = [...new Set(projectsEls.map((el) => el.offsetLeft))].sort((a, b) => b - a);
    const tops = [...new Set(projectsEls.map((el) => el.offsetTop))].sort((a, b) => a - b);
    const taken = new Set(projectsEls.map((el) => `${el.offsetLeft},${el.offsetTop}`));
    const step = lefts.length > 1 ? lefts[0] - lefts[1] : 120;

    const spots = {};
    let column = 0;
    for (const folder of desktopFolders) {
      for (;;) {
        const left = lefts[column] ?? lefts[lefts.length - 1] - step * (column - lefts.length + 1);
        const top = tops.find((t) => !taken.has(`${left},${t}`));
        if (top === undefined) {
          column += 1;
          continue;
        }
        taken.add(`${left},${top}`);
        spots[folder.id] = { x: left, y: top };
        break;
      }
    }
    placeDesktopFolders(spots);
  }, [cleanUps]);

  return (
    <section id="home" ref={homeRef}>
      <ul>
        {projects.map((project) => (
          <li
            key={project.id}
            data-id={project.id}
            data-project
            className={clsx("group folder", project.windowPosition)}
            onClick={() => openFinderWindow(project)}
          >
            <AppIcon icon="folder" />
            <p>{project.name}</p>
          </li>
        ))}

        {desktopFolders.map((folder) => (
          <li
            key={folder.id}
            data-id={folder.id}
            className="group folder"
            style={{ left: folder.x, top: folder.y }}
            onClick={() => openUserFolder(folder)}
          >
            <AppIcon icon="folder" />
            <p>{folder.name}</p>
          </li>
        ))}
      </ul>
    </section>
  );
};

export default Home;
