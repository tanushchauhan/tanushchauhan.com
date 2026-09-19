/** Counts this page load once; the terminal shares the same promise. */
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
