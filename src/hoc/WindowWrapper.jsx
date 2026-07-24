import { useEffect, useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import { Draggable } from "gsap/Draggable";
import { useGSAP } from "@gsap/react";
import clsx from "clsx";
import useWindowStore from "#store/window.js";

gsap.registerPlugin(Draggable);

const WindowWrapper = (Component, windowKey) => {
  const Wrapped = (props) => {
    const { focusWindow, setWindowPos, windows } = useWindowStore();
    const { isOpen, isMinimized, isMaximized, zIndex, pos } = windows[windowKey];
    const ref = useRef(null);
    const dragRef = useRef(null);
    const minTargetRef = useRef(null); // where the window flew when minimized
    const shownRef = useRef(false); // has this window been visible this session?

    const visible = isOpen && !isMinimized;

    useLayoutEffect(() => {
      const el = ref.current;
      if (!el) return;
      if (visible) {
        el.style.display = "flex";
        shownRef.current = true;
      } else if (!isOpen || !shownRef.current) {
        // closed, or hydrated straight into a minimized state: stay hidden
        el.style.display = "none";
      }
      // an actual minimize keeps display until its animation hides it
    }, [visible, isOpen]);

    useGSAP(() => {
      const el = ref.current;
      if (!el) return;

      if (visible) {
        const target = minTargetRef.current;
        if (target) {
          // fly back out of the dock tile
          minTargetRef.current = null;
          gsap.fromTo(
            el,
            { x: target.x, y: target.y, scale: 0.04, opacity: 0.5 },
            {
              x: target.baseX,
              y: target.baseY,
              scale: 1,
              opacity: 1,
              duration: 0.45,
              ease: "power3.out",
            }
          );
        } else {
          gsap.fromTo(
            el,
            { scale: 0.85, opacity: 0 },
            { scale: 1, opacity: 1, duration: 0.35, ease: "power3.out" }
          );
        }
      } else if (isOpen && isMinimized) {
        // hydrated as minimized (never shown this session): no animation to play
        if (!shownRef.current) return;

        // fly into this window's minimized tile in the dock
        const baseX = Number(gsap.getProperty(el, "x"));
        const baseY = Number(gsap.getProperty(el, "y"));
        const er = el.getBoundingClientRect();
        const tile = document.querySelector(`[data-min-tile="${windowKey}"]`);

        let dx = 0;
        let dy = window.innerHeight - (er.top + er.height / 2);
        if (tile) {
          const tr = tile.getBoundingClientRect();
          dx = tr.left + tr.width / 2 - (er.left + er.width / 2);
          dy = tr.top + tr.height / 2 - (er.top + er.height / 2);
        }

        minTargetRef.current = { x: baseX + dx, y: baseY + dy, baseX, baseY };
        gsap.to(el, {
          x: baseX + dx,
          y: baseY + dy,
          scale: 0.04,
          opacity: 0.5,
          duration: 0.45,
          ease: "power3.in",
          onComplete: () => {
            el.style.display = "none";
            gsap.set(el, { x: baseX, y: baseY, scale: 1, opacity: 1 });
          },
        });
      }
    }, [visible, isOpen, isMinimized]);

    useGSAP(() => {
      const el = ref.current;
      if (!el) return;

      // restore the last dragged position from the persisted store
      const saved = useWindowStore.getState().windows[windowKey].pos;
      if (saved) gsap.set(el, { x: saved.x, y: saved.y });

      const [instance] = Draggable.create(el, {
        trigger: el.querySelector("#window-header") ?? el,
        bounds: "main",
        onPress: () => focusWindow(windowKey),
        onDragEnd() {
          setWindowPos(windowKey, { x: this.x, y: this.y });
        },
      });
      dragRef.current = instance;

      return () => instance?.kill();
    }, []);

    // a maximized window fills the desktop; drag is suspended until restored
    useEffect(() => {
      const el = ref.current;
      const drag = dragRef.current;
      if (!el) return;
      if (isMaximized) {
        gsap.set(el, { x: 0, y: 0 });
        drag?.disable();
      } else {
        drag?.enable();
      }
    }, [isMaximized]);

    return (
      <section
        id={windowKey}
        ref={ref}
        style={{ zIndex }}
        className={clsx("window", isMaximized && "maximized")}
        onMouseDown={() => focusWindow(windowKey)}
      >
        <Component {...props} />
      </section>
    );
  };

  Wrapped.displayName = `WindowWrapper(${Component.displayName || Component.name || "Component"})`;

  return Wrapped;
};

export default WindowWrapper;
