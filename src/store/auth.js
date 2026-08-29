import { create } from "zustand";

/**
 * Loaded only when someone actually starts a passkey ceremony. Exactly one
 * person will ever log in here, so making every visitor download the WebAuthn
 * browser helpers would undo part of the bundle work for no one's benefit.
 * Nothing may import from this module statically or it lands back in the main
 * chunk.
 */
const webauthn = () => import("@simplewebauthn/browser");

/**
 * Auth state, deliberately NOT persisted. The session lives in an httpOnly
 * cookie the page cannot read, so localStorage could only ever hold a stale
 * copy of the answer: it would claim you were logged in after the cookie
 * expired, or claim you were not right after you logged in on another tab.
 * The server is the only source of truth and `refresh()` is how we ask it.
 */
const json = async (url, options = {}) => {
  const res = await fetch(url, {
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    ...options,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `request failed (${res.status})`);
  return body;
};

const useAuthStore = create((set, get) => ({
  status: "unknown", // unknown | anonymous | authed
  user: null,
  passkey: null,
  needsEnrollment: false,
  busy: false,

  refresh: async () => {
    try {
      const me = await json("/api/auth/me");
      set({
        status: me.authenticated ? "authed" : "anonymous",
        user: me.user ?? null,
        passkey: me.passkey ?? null,
        needsEnrollment: Boolean(me.needsEnrollment),
      });
      return me;
    } catch {
      // the API being unreachable is not the same as being logged out, but for
      // the UI's purposes it has to behave the same way
      set({ status: "anonymous", user: null, passkey: null });
      return { authenticated: false };
    }
  },

  /** Touch ID / Face ID login. Resolves to a short message for the terminal. */
  login: async () => {
    if (get().busy) return "a passkey prompt is already open.";
    set({ busy: true });
    try {
      const { startAuthentication } = await webauthn();
      const options = await json("/api/auth/login/options", { method: "POST" });
      const response = await startAuthentication({ optionsJSON: options });
      await json("/api/auth/login/verify", {
        method: "POST",
        body: JSON.stringify({ response }),
      });
      await get().refresh();
      return "authenticated. welcome back.";
    } catch (error) {
      return `login failed: ${friendly(error)}`;
    } finally {
      set({ busy: false });
    }
  },

  /** Enrolls a passkey. Requires a break-glass token unless already logged in. */
  enroll: async (bootstrapToken, nickname) => {
    if (get().busy) return "a passkey prompt is already open.";
    set({ busy: true });
    try {
      const { startRegistration } = await webauthn();
      const payload = { bootstrapToken, nickname };
      const options = await json("/api/auth/register/options", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      const response = await startRegistration({ optionsJSON: options });
      await json("/api/auth/register/verify", {
        method: "POST",
        body: JSON.stringify({ ...payload, response }),
      });
      await get().refresh();
      return "passkey registered, and you are now signed in.";
    } catch (error) {
      return `enrollment failed: ${friendly(error)}`;
    } finally {
      set({ busy: false });
    }
  },

  logout: async () => {
    try {
      await json("/api/auth/logout", { method: "POST" });
    } catch {
      /* logging out locally matters more than the request succeeding */
    }
    await get().refresh();
    return "signed out.";
  },
}));

/** WebAuthn's DOMExceptions are unreadable; translate the ones we expect. */
const friendly = (error) => {
  const name = error?.name;
  if (name === "NotAllowedError") return "cancelled, or the prompt timed out.";
  if (name === "InvalidStateError") return "that passkey is already registered.";
  if (name === "SecurityError")
    return "origin mismatch. passkeys are bound to the domain they were created on.";
  return error?.message ?? "unknown error";
};

export default useAuthStore;
