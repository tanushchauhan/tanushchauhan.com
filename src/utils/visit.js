/**
 * Registers this page load with the visitor counter, once.
 *
 * The terminal's `visitor` command wants the same answer, so it shares this
 * promise rather than posting again and counting one visit as two. A request
 * that failed is forgotten, so the next caller gets a fresh attempt instead of
 * a cached failure.
 */
let pending = null;

export const registerVisit = () => {
  pending ??= fetch("/api/visit", { method: "POST", credentials: "same-origin" })
    .then((res) => (res.ok ? res.json() : null))
    .catch(() => null)
    .then((visit) => {
      if (!visit) pending = null;
      return visit;
    });
  return pending;
};
