import { useEffect, useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import { Draggable } from "gsap/Draggable";
import { useGSAP } from "@gsap/react";
import clsx from "clsx";
import useWindowStore from "#store/window.js";

gsap.registerPlugin(Draggable);

// corners last, so they sit above the edges they overlap
const EDGES = ["n", "s", "e", "w", "nw", "ne", "sw", "se"];

const DEFAULT_MIN = { w: 360, h: 240 };

const CURSOR = {
  n: "ns-resize",
  s: "ns-resize",
  e: "ew-resize",
  w: "ew-resize",
  nw: "nwse-resize",
  se: "nwse-resize",
  ne: "nesw-resize",
  sw: "nesw-resize",
};

const clamp = (value, low, high) => Math.min(Math.max(value, low), Math.max(low, high));

// an explicit height turns off the stylesheet's max-height
const applySize = (el, w, h) => {
  el.style.width = `${w}px`;
  el.style.height = `${h}px`;
  el.style.maxHeight = "none";
};

const WindowWrapper = (Component, windowKey, options = {}) => {
  const { resizable = true, min = DEFAULT_MIN } = options;

  const Wrapped = (props) => {
    const { focusWindow, setWindowPos, setWindowSize, windows } = useWindowStore();
    const { isOpen, isMinimized, isMaximized, zIndex } = windows[windowKey];
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
        el.style.display = "none";
      }
    }, [visible, isOpen]);

    useGSAP(() => {
      const el = ref.current;
      if (!el) return;

      if (visible) {
        const target = minTargetRef.current;
        if (target) {
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
        if (!shownRef.current) return;

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

      const win = useWindowStore.getState().windows[windowKey];
      if (win.pos) gsap.set(el, { x: win.pos.x, y: win.pos.y });
      // clamped, since a size from a big monitor may not fit this screen
      if (win.size) {
        const b = (el.closest("main") ?? document.body).getBoundingClientRect();
        applySize(
          el,
          clamp(win.size.w, min.w, b.width),
          clamp(win.size.h, min.h, b.height)
        );
      }
    }, []);

    // created once there is a header to grab: the viewers render nothing until
    // they have a file, and without a header the whole window became the handle
    useEffect(() => {
      const el = ref.current;
      if (!el || dragRef.current) return;
      const header = el.querySelector("#window-header");
      if (!header) return;

      const [instance] = Draggable.create(el, {
        trigger: header,
        bounds: "main",
        onPress: () => focusWindow(windowKey),
        onDragEnd() {
          setWindowPos(windowKey, { x: this.x, y: this.y });
        },
      });
      if (isMaximized) instance.disable();
      dragRef.current = instance;
    });

    useEffect(() => () => dragRef.current?.kill(), []);

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

    const startResize = (dir) => (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      const el = ref.current;
      if (!el) return;
      focusWindow(windowKey);

      const bounds = (el.closest("main") ?? document.body).getBoundingClientRect();
      const r = el.getBoundingClientRect();
      const x0 = Number(gsap.getProperty(el, "x"));
      const y0 = Number(gsap.getProperty(el, "y"));
      const sx = e.clientX;
      const sy = e.clientY;

      el.classList.add("resizing");
      document.body.classList.add("resizing");
      document.body.style.cursor = CURSOR[dir];

      let next = { w: r.width, h: r.height, x: x0, y: y0 };

      const move = (ev) => {
        let { width: w, height: h } = r;
        let x = x0;
        let y = y0;
        const dx = ev.clientX - sx;
        const dy = ev.clientY - sy;

        // north and west move the window too, by the clamped size change
        if (dir.includes("e")) w = clamp(r.width + dx, min.w, bounds.right - r.left);
        if (dir.includes("w")) w = clamp(r.width - dx, min.w, r.right - bounds.left);
        if (dir.includes("s")) h = clamp(r.height + dy, min.h, bounds.bottom - r.top);
        if (dir.includes("n")) h = clamp(r.height - dy, min.h, r.bottom - bounds.top);
        if (dir.includes("w")) x = x0 + (r.width - w);
        if (dir.includes("n")) y = y0 + (r.height - h);

        next = { w, h, x, y };
        applySize(el, w, h);
        gsap.set(el, { x, y });
      };

      const stop = () => {
        document.removeEventListener("pointermove", move);
        el.classList.remove("resizing");
        document.body.classList.remove("resizing");
        document.body.style.cursor = "";

        setWindowSize(windowKey, { w: Math.round(next.w), h: Math.round(next.h) });
        if (next.x !== x0 || next.y !== y0) {
          setWindowPos(windowKey, { x: next.x, y: next.y });
        }
        dragRef.current?.update(true);
      };

      document.addEventListener("pointermove", move);
      document.addEventListener("pointerup", stop, { once: true });
    };

    return (
      <section
        id={windowKey}
        ref={ref}
        style={{ zIndex }}
        className={clsx("window", isMaximized && "maximized")}
        onMouseDown={() => focusWindow(windowKey)}
      >
        <Component {...props} />

        {resizable &&
          !isMaximized &&
          EDGES.map((dir) => (
            <span
              key={dir}
              className={`rh rh-${dir}`}
              style={{ cursor: CURSOR[dir] }}
              onPointerDown={startResize(dir)}
            />
          ))}
      </section>
    );
  };

  Wrapped.displayName = `WindowWrapper(${Component.displayName || Component.name || "Component"})`;

  return Wrapped;
};

export default WindowWrapper;
