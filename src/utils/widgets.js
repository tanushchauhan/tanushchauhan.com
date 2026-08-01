/**
 * A nudge for the desktop and mobile widget cards.
 *
 * They poll on a long timer, because the data behind them barely moves and
 * GitHub is cached server-side anyway. That is right for the background case
 * and wrong for the one where I have just changed something myself: setting
 * "now building" from the terminal and watching the card sit on the old text
 * for the next quarter of an hour reads as a broken widget rather than a slow
 * one. Anything that writes widget data calls this and the cards refetch.
 *
 * An event rather than a store because there is no state here to own: the
 * cards already know how to load themselves, they just need telling when.
 */
const REFRESH = "widgets:refresh";

export const refreshWidgets = () => window.dispatchEvent(new Event(REFRESH));

export const onRefreshWidgets = (handler) => {
  window.addEventListener(REFRESH, handler);
  return () => window.removeEventListener(REFRESH, handler);
};
