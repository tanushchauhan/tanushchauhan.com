import { create } from "zustand";
import { persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import { play, setSoundEnabled } from "../utils/sound.js";
import { DEFAULT_WALLPAPER, derefData, refFor } from "../constants/index.js";

const INITIAL_Z_INDEX = 1000;

export const FINDER_KEYS = ["finder", "finder2", "finder3"];

const WINDOW_KEYS = [
  ...FINDER_KEYS,
  "safari",
  "photos",
  "contact",
  "guestbook",
  "terminal",
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
      pos: null,
      size: null,
    },
  ])
);

const useWindowStore = create(
  persist(
    immer((set, get) => ({
      windows: WINDOW_CONFIG,
      nextZIndex: INITIAL_Z_INDEX + 1,
      spotlightOpen: false,
      controlCenterOpen: false,
      theme: "auto", // "auto" | "light" | "dark"
      glass: "regular", // "clear" | "regular" | "tinted"
      wallpaper: DEFAULT_WALLPAPER,
      folderPos: {}, // desktop folder drag offsets, keyed by project id
      // widget drag offsets, keyed by layout and then by widget id, since an
      // offset only means something in the grid it was measured in
      widgetPos: {},

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

      // null means use the stylesheet's size
      setWindowSize: (windowKey, size) =>
        set((state) => {
          const win = state.windows[windowKey];
          if (!win) return;
          win.size = size;
        }),

      setFolderPos: (id, pos) =>
        set((state) => {
          state.folderPos[id] = pos;
        }),

      setWidgetPos: (layout, id, pos) =>
        set((state) => {
          state.widgetPos[layout] ??= {};
          state.widgetPos[layout][id] = pos;
        }),

      // not persisted
      quickLook: null,

      setQuickLook: (preview) =>
        set((state) => {
          state.quickLook = preview;
        }),

      setSpotlight: (open) =>
        set((state) => {
          state.spotlightOpen = open;
        }),

      setTheme: (theme) =>
        set((state) => {
          state.theme = theme;
        }),

      setWallpaper: (wallpaper) =>
        set((state) => {
          state.wallpaper = wallpaper;
        }),

      setGlass: (glass) =>
        set((state) => {
          state.glass = glass;
        }),

      setControlCenter: (open) =>
        set((state) => {
          state.controlCenterOpen = open;
        }),

      soundOn: false,

      toggleSound: () => {
        const on = !get().soundOn;
        setSoundEnabled(on);
        if (on) play("open");
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

      // bumped by Clean Up so Home can move new folders onto the grid
      cleanUps: 0,

      resetFolderPos: () =>
        set((state) => {
          state.folderPos = {};
          state.widgetPos = {};
          state.cleanUps += 1;
        }),

      placeDesktopFolders: (spots) =>
        set((state) => {
          state.desktopFolders.forEach((folder) => {
            const spot = spots[folder.id];
            if (spot) Object.assign(folder, spot);
          });
        }),

      // reuse the window showing this folder, else a free one, else the oldest
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
      version: 3,
      migrate: (persisted, version) => {
        if (version < 1) persisted = { ...persisted, theme: "auto" };
        if (version < 2) persisted = { ...persisted, widgetPos: {} };
        // v3 stores window data as a reference instead of a copy
        if (version < 3) {
          persisted = {
            ...persisted,
            windows: Object.fromEntries(
              Object.entries(persisted?.windows ?? {}).map(([key, win]) => {
                const ref = win?.data?.id ? { ref: win.data.id } : null;
                const dropped = win?.data != null && ref === null;
                return [
                  key,
                  { ...win, data: ref, ...(dropped && { isOpen: false, isMinimized: false }) },
                ];
              })
            ),
          };
        }
        return persisted;
      },
      // rebuilt from the defaults so windows added since are filled in
      merge: (persisted, current) => ({
        ...current,
        ...persisted,
        windows: Object.fromEntries(
          Object.entries(current.windows).map(([key, defaults]) => {
            const saved = persisted?.windows?.[key] ?? {};
            const data = derefData(saved.data);
            const lost = saved.data != null && data == null;
            return [
              key,
              { ...defaults, ...saved, data, ...(lost && { isOpen: false, isMinimized: false }) },
            ];
          })
        ),
      }),
      partialize: (state) => ({
        windows: Object.fromEntries(
          Object.entries(state.windows).map(([key, win]) => [
            key,
            { ...win, data: refFor(win.data) },
          ])
        ),
        nextZIndex: state.nextZIndex,
        theme: state.theme,
        glass: state.glass,
        wallpaper: state.wallpaper,
        folderPos: state.folderPos,
        widgetPos: state.widgetPos,
        soundOn: state.soundOn,
        desktopFolders: state.desktopFolders,
      }),
    }
  )
);

export default useWindowStore;
