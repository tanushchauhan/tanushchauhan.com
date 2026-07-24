import { useEffect } from "react";
import gsap from "gsap";
import { Draggable } from "gsap/Draggable";
import { useGSAP } from "@gsap/react";
import clsx from "clsx";
import { locations } from "#constants";
import useWindowStore from "#store/window.js";

gsap.registerPlugin(Draggable);

const Home = () => {
  const projects = locations.work?.children ?? [];
  const { openFinderWindow, setFolderPos, folderPos, desktopFolders } =
    useWindowStore();

  const openUserFolder = (folder) =>
    openFinderWindow({
      id: folder.id,
      name: folder.name,
      icon: "/images/folder.png",
      kind: "folder",
      children: [],
    });

  useGSAP(() => {
    // restore persisted folder drag offsets
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

  // "Clean Up" empties folderPos: snap every icon back to its home position
  useEffect(() => {
    if (Object.keys(folderPos).length === 0)
      gsap.to("#home .folder", { x: 0, y: 0, duration: 0.3, ease: "power2.out" });
  }, [folderPos]);

  return (
    <section id="home">
      <ul>
        {projects.map((project) => (
          <li
            key={project.id}
            data-id={project.id}
            className={clsx("group folder", project.windowPosition)}
            onClick={() => openFinderWindow(project)}
          >
            <img src="/images/folder.png" alt={project.name} />
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
            <img src="/images/folder.png" alt={folder.name} />
            <p>{folder.name}</p>
          </li>
        ))}
      </ul>
    </section>
  );
};

export default Home;
