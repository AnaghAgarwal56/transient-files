// Client-side storage of the temporary room session token.
// The token is a random 256-bit value; the server only stores its hash.

const PREFIX = "dt.session.";

export interface StoredSession {
  roomId: string;
  token: string;
  displayName: string;
}

export function saveSession(session: StoredSession) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PREFIX + session.roomId, JSON.stringify(session));
  window.localStorage.setItem("dt.lastRoom", session.roomId);
}

export function loadSession(roomId: string): StoredSession | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(PREFIX + roomId.toUpperCase());
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredSession;
    return parsed.token ? parsed : null;
  } catch {
    return null;
  }
}

export function clearSession(roomId: string) {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(PREFIX + roomId.toUpperCase());
}

export function lastRoom(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem("dt.lastRoom");
}
