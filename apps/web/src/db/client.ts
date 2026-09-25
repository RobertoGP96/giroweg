import { createPersister, loadPersistedState } from "./persistence";
import { isQuotaError, usePersistStatus } from "./persistStatus";
import { LocalStore, type LocalSession } from "./store";

/** Single local store instance for the app session, restored from disk. */
let store: LocalStore | null = null;

/**
 * Surfaces a full localStorage in the UI: set on a quota error, cleared as
 * soon as a write goes through again.
 */
const reportPersist = (_key: string, error: unknown): void => {
  const { quotaExceeded, setQuotaExceeded } = usePersistStatus.getState();
  if (error === null) {
    if (quotaExceeded) setQuotaExceeded(false);
  } else if (isQuotaError(error) && !quotaExceeded) {
    setQuotaExceeded(true);
  }
};

export const getStore = (): LocalStore => {
  if (!store) store = new LocalStore(loadPersistedState(), createPersister(reportPersist));
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
