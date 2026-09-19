/** Tells the widget cards to refetch now, after something changes their data. */
const REFRESH = "widgets:refresh";

export const refreshWidgets = () => window.dispatchEvent(new Event(REFRESH));

export const onRefreshWidgets = (handler) => {
  window.addEventListener(REFRESH, handler);
  return () => window.removeEventListener(REFRESH, handler);
};
