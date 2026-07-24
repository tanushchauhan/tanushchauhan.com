import { create } from "zustand";
import { persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import { play, setSoundEnabled } from "../utils/sound.js";

const INITIAL_Z_INDEX = 1000;

export const FINDER_KEYS = ["finder", "finder2", "finder3"];

const WINDOW_KEYS = [
  ...FINDER_KEYS,
  "safari",
  "photos",
  "contact",
  "terminal",
  "resume",
  "txtFile",
  "imgFile",
  "about",
];

const WINDOW_CONFIG = Object.fromEntries(
  WINDOW_KEYS.map((key) => [
    key,
    {
      isOpen: false,
      isMinimized: false,
      isMaximized: false,
      zIndex: INITIAL_Z_INDEX,
      data: null,
      pos: null, // last dragged {x, y}, persisted
    },
  ])
);

const useWindowStore = create(
  persist(
    immer((set, get) => ({
      windows: WINDOW_CONFIG,
      nextZIndex: INITIAL_Z_INDEX + 1,
      spotlightOpen: false,
      theme: "auto", // "auto" | "light" | "dark"
      folderPos: {}, // desktop folder drag offsets, keyed by project id

      openWindow: (windowKey, data = null) => {
        if (!get().windows[windowKey]?.isOpen) play("open");
        set((state) => {
          const win = state.windows[windowKey];
          if (!win) return;

          win.isOpen = true;
          win.isMinimized = false;
          win.zIndex = state.nextZIndex;
          win.data = data ?? win.data;
          state.nextZIndex += 1;
        });
      },

      closeWindow: (windowKey) => {
        if (get().windows[windowKey]?.isOpen) play("close");
        set((state) => {
          const win = state.windows[windowKey];
          if (!win) return;

          win.isOpen = false;
          win.isMinimized = false;
          win.isMaximized = false;
          win.zIndex = INITIAL_Z_INDEX;
          win.data = null;
        });
      },

      focusWindow: (windowKey) =>
        set((state) => {
          const win = state.windows[windowKey];
          if (!win) return;

          win.zIndex = state.nextZIndex;
          state.nextZIndex += 1;
        }),

      minimizeWindow: (windowKey) => {
        play("minimize");
        set((state) => {
          const win = state.windows[windowKey];
          if (!win) return;
          win.isMinimized = true;
        });
      },

      restoreWindow: (windowKey) => {
        play("restore");
        set((state) => {
          const win = state.windows[windowKey];
          if (!win) return;
          win.isMinimized = false;
          win.zIndex = state.nextZIndex;
          state.nextZIndex += 1;
        });
      },

      toggleMaximize: (windowKey) =>
        set((state) => {
          const win = state.windows[windowKey];
          if (!win) return;
          win.isMaximized = !win.isMaximized;
          win.zIndex = state.nextZIndex;
          state.nextZIndex += 1;
        }),

      setWindowPos: (windowKey, pos) =>
        set((state) => {
          const win = state.windows[windowKey];
          if (!win) return;
          win.pos = pos;
        }),

      setFolderPos: (id, pos) =>
        set((state) => {
          state.folderPos[id] = pos;
        }),

      setSpotlight: (open) =>
        set((state) => {
          state.spotlightOpen = open;
        }),

      setTheme: (theme) =>
        set((state) => {
          state.theme = theme;
        }),

      soundOn: false,

      toggleSound: () => {
        const on = !get().soundOn;
        setSoundEnabled(on);
        if (on) play("open"); // audible confirmation
        set((state) => {
          state.soundOn = on;
        });
      },

      desktopFolders: [],

      addDesktopFolder: ({ x, y }) =>
        set((state) => {
          const n = state.desktopFolders.length + 1;
          state.desktopFolders.push({
            id: `untitled-${Date.now()}`,
            name: n === 1 ? "untitled folder" : `untitled folder ${n}`,
            x,
            y,
          });
        }),

      resetFolderPos: () =>
        set((state) => {
          state.folderPos = {};
        }),

      // open a folder in a Finder window: reuse the window already showing it,
      // otherwise take a free instance, otherwise the least-recently-focused one
      openFinderWindow: (location = null) => {
        play("open");
        set((state) => {
          let key =
            location &&
            FINDER_KEYS.find(
              (k) =>
                state.windows[k].isOpen &&
                state.windows[k].data?.id === location.id
            );
          if (!key) key = FINDER_KEYS.find((k) => !state.windows[k].isOpen);
          if (!key) {
            key = FINDER_KEYS.reduce((a, b) =>
              state.windows[a].zIndex <= state.windows[b].zIndex ? a : b
            );
          }

          const win = state.windows[key];
          win.isOpen = true;
          win.isMinimized = false;
          win.data = location ?? win.data;
          win.zIndex = state.nextZIndex;
          state.nextZIndex += 1;
        });
      },
    })),
    {
      name: "tanushos-v1",
      version: 1,
      // v0 had a light/dark toggle; "auto" (follow the system) is the new default
      migrate: (persisted, version) =>
        version < 1 ? { ...persisted, theme: "auto" } : persisted,
      partialize: (state) => ({
        windows: state.windows,
        nextZIndex: state.nextZIndex,
        theme: state.theme,
        folderPos: state.folderPos,
        soundOn: state.soundOn,
        desktopFolders: state.desktopFolders,
      }),
    }
  )
);

export default useWindowStore;
