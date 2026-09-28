import { track } from "./telemetry.js";

export const openFile = (item, openWindow) => {
  if (["fig", "url"].includes(item.fileType) && item.href) {
    track("link_click", hostOf(item.href), { from: item.id ?? null });
    return window.open(item.href, "_blank", "noopener,noreferrer");
  }
  track("file_open", item.id ?? item.name ?? null, { type: item.fileType });
  openWindow(`${item.fileType}File`, item.data);
};

const hostOf = (href) => {
  try {
    return new URL(href, location.origin).host;
  } catch {
    return null;
  }
};
