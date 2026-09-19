export const openFile = (item, openWindow) => {
  if (["fig", "url"].includes(item.fileType) && item.href)
    return window.open(item.href, "_blank", "noopener,noreferrer");
  openWindow(`${item.fileType}File`, item.data);
};
