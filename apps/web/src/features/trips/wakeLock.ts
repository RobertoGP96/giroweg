/**
 * Screen wake lock as a module singleton (one sentinel per page). The trip
 * screen keeps the display on while recording; the state is exposed as an
 * external store so React can subscribe without owning the sentinel.
 */

export type WakeLockState = "unsupported" | "released" | "held" | "failed";

type Listener = () => void;

let state: WakeLockState = "released";
let sentinel: WakeLockSentinel | null = null;
const listeners = new Set<Listener>();

const setState = (next: WakeLockState) => {
  if (state === next) return;
  state = next;
  for (const listener of listeners) listener();
};

const supported = (): boolean =>
  typeof navigator !== "undefined" && "wakeLock" in navigator && navigator.wakeLock !== undefined;

export const getWakeLockState = (): WakeLockState => state;

export const subscribeWakeLock = (listener: Listener): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** Acquires the screen lock (idempotent while held). */
export const requestWakeLock = async (): Promise<WakeLockState> => {
  if (!supported()) {
    setState("unsupported");
    return state;
  }
  if (sentinel !== null && !sentinel.released) {
    setState("held");
    return state;
  }
  try {
    const next = await navigator.wakeLock.request("screen");
    sentinel = next;
    next.addEventListener("release", () => {
      if (sentinel === next) {
        sentinel = null;
        setState("released");
      }
    });
    setState("held");
  } catch {
    sentinel = null;
    setState("failed");
  }
  return state;
};

export const releaseWakeLock = async (): Promise<void> => {
  const current = sentinel;
  sentinel = null;
  if (current !== null && !current.released) {
    try {
      await current.release();
    } catch {
      // The browser may already have dropped it (tab hidden); nothing to undo.
    }
  }
  if (state !== "unsupported") setState("released");
};
