import { createPersister, loadPersistedState } from "./persistence";
import { LocalStore, type LocalSession } from "./store";

/** Single local store instance for the app session, restored from disk. */
let store: LocalStore | null = null;

export const getStore = (): LocalStore => {
  if (!store) store = new LocalStore(loadPersistedState(), createPersister());
  return store;
};

/** Thrown when a write happens before the device knows its organization. */
export class NoSessionError extends Error {
  constructor() {
    super("No local session: sign in and sync before writing");
    this.name = "NoSessionError";
  }
}

export const requireSession = (): LocalSession => {
  const session = getStore().session;
  if (!session) throw new NoSessionError();
  return session;
};
