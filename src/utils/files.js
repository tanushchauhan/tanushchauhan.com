/**
 * What opening a Finder item means, in one place: a folder is navigated into by
 * whoever asked, a link goes to a new tab, and a file opens in the viewer for
 * its type. Finder and Quick Look both open things, and they should agree.
 */
export const openFile = (item, openWindow) => {
  if (["fig", "url"].includes(item.fileType) && item.href)
    return window.open(item.href, "_blank", "noopener,noreferrer");
  openWindow(`${item.fileType}File`, item.data);
};
