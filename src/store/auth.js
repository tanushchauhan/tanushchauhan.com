import { create } from "zustand";

// loaded only when a passkey ceremony starts, to keep it out of the main bundle
const webauthn = () => import("@simplewebauthn/browser");

// not persisted: the session is an httpOnly cookie, so the server is the source of truth
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
      // an unreachable API is treated as signed out
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
