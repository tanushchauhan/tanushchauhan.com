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
      pos: null, // last dragged {x, y}, persisted
      size: null, // last resized {w, h}, persisted
    },
  ])
);

const useWindowStore = create(
  persist(
    immer((set, get) => ({
      windows: WINDOW_CONFIG,
      nextZIndex: INITIAL_Z_INDEX + 1,
      spotlightOpen: false,
      controlCenterOpen: false, // like spotlight, not worth persisting
      theme: "auto", // "auto" | "light" | "dark"
      glass: "regular", // "clear" | "regular" | "tinted": how much the chrome shows through
      wallpaper: DEFAULT_WALLPAPER,
      folderPos: {}, // desktop folder drag offsets, keyed by project id
      // Desktop widget drag offsets, keyed first by layout signature and only
      // then by widget id. An offset is a translation away from where the grid
      // put a card, so it means nothing once the grid changes: signing in adds
      // a card and moves the block, and a deploy can change the geometry under
      // a tab that has been open for days. Keeping one bucket per layout means
      // each arrangement is remembered on its own terms instead of being
      // replayed against a grid it was never measured in.
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

      // Null means "whatever the stylesheet says", which is what a window that
      // has never been resized should keep using: the CSS sizes are tuned per
      // window and expressed in viewport units, so they follow a screen the
      // saved pixels would not.
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

      // The item Quick Look is showing, and the Finder window it came from.
      // Not persisted: a preview is a glance, not something to reopen on load.
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

      // Bumped by every Clean Up, and not persisted: Home watches it to put
      // the folders I made onto the grid. An empty folderPos cannot be the
      // signal, because that is also what every fresh load looks like.
      cleanUps: 0,

      resetFolderPos: () =>
        set((state) => {
          state.folderPos = {};
          state.widgetPos = {};
          state.cleanUps += 1;
        }),

      /** Clean Up's second half: new folders onto the grid, as { id: {x, y} }. */
      placeDesktopFolders: (spots) =>
        set((state) => {
          state.desktopFolders.forEach((folder) => {
            const spot = spots[folder.id];
            if (spot) Object.assign(folder, spot);
          });
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
      version: 3,
      migrate: (persisted, version) => {
        // v0 had a light/dark toggle; "auto" (follow the system) is the default
        if (version < 1) persisted = { ...persisted, theme: "auto" };
        // v1 kept widget offsets in one flat bucket with nothing recording
        // which layout produced them. There is no way to tell now, so they go:
        // a card back at its home position is right, a card replaying a
        // measurement from a grid that no longer exists is not.
        if (version < 2) persisted = { ...persisted, widgetPos: {} };
        /* v2 kept a copy of the constants node in each window's `data`, so a
           browser went on rendering whatever the copy said on the day it was
           opened. Anything carrying an id becomes a reference. The rest were
           file contents with no way back to a node, so they go, and the window
           holding one goes with them rather than opening as a blank frame. */
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
      // Saved state replaces defaults wholesale, so a browser holding an older
      // `windows` object would be missing any window added since. Rebuilding
      // from the current defaults backfills both new window keys and new
      // per-window fields, and drops any that no longer exist.
      merge: (persisted, current) => ({
        ...current,
        ...persisted,
        windows: Object.fromEntries(
          Object.entries(current.windows).map(([key, defaults]) => {
            const saved = persisted?.windows?.[key] ?? {};
            const data = derefData(saved.data);
            // a window pointing at a file this build no longer has stays shut
            const lost = saved.data != null && data == null;
            return [
              key,
              { ...defaults, ...saved, data, ...(lost && { isOpen: false, isMinimized: false }) },
            ];
          })
        ),
      }),
      partialize: (state) => ({
        // `data` is stored as a reference, never as a copy of the words in it
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
