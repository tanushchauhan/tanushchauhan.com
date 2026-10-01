/**
 * A signal that the visit data moved, for an open Analytics window to refetch
 * on. One process serves the site, so listeners in memory are enough.
 */
type Listener = (mine: boolean) => void;

const listeners = new Set<Listener>();

export const onVisitChange = (listener: Listener) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** `mine` says the change came from one of my own browsers. */
export const visitChanged = (mine: boolean) => {
  for (const listener of listeners) listener(mine);
};
