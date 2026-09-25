/**
 * Local data store: the source of truth for the UI. On the web it lives in
 * memory and is mirrored to localStorage (persistence.ts); it exposes the
 * same contract the SQLite/Drizzle layer implements on mobile: tables plus an
 * outbox written in the same change. Only feature repositories and the sync
 * engine may import it.
 */
import type { Reading, Trip, TripRoute, Vehicle } from "@giroweg/shared/schemas";
import { nowIso, uuidv7 } from "@/lib/id";

export interface Tables {
  vehicles: Vehicle[];
  readings: Reading[];
  trips: Trip[];
  tripRoutes: TripRoute[];
}

export type TableName = keyof Tables;
/** Every table, in the order the sync engine pushes them (parents first). */
export const TABLE_NAMES = ["vehicles", "readings", "trips", "tripRoutes"] as const;

export interface OutboxEntry {
  id: string;
  table: TableName;
  recordId: string;
  operation: "upsert";
  createdAt: string;
  attempts: number;
  lastError: string | null;
  /** Earliest instant the sync engine may retry this entry (backoff). */
  nextAttemptAt: string | null;
}

/** Who is signed in on this device and which organization they write to. */
export interface LocalSession {
  userId: string;
  orgId: string;
}

export interface Preferences {
  selectedVehicleId: string | null;
}

export interface StoreState extends Tables {
  outbox: OutboxEntry[];
  session: LocalSession | null;
  prefs: Preferences;
  /** Server time of the last successful pull. */
  pulledAt: string | null;
}

/** Narrows a manual retry to the entries that match (no filter = all). */
export interface RetryFilter {
  errors?: readonly string[];
  tables?: readonly TableName[];
}

type Row<K extends TableName> = Tables[K][number];
type Listener = () => void;
type Persist = (state: StoreState) => void;

export const emptyState = (): StoreState => ({
  vehicles: [],
  readings: [],
  trips: [],
  tripRoutes: [],
  outbox: [],
  session: null,
  prefs: { selectedVehicleId: null },
  pulledAt: null,
});

const upsert = <T extends { id: string }>(rows: T[], record: T): T[] => {
  const index = rows.findIndex((row) => row.id === record.id);
  return index === -1 ? [...rows, record] : rows.map((row, i) => (i === index ? record : row));
};

/**
 * Merges server rows into a local table. A local row that is still waiting
 * in the outbox wins when it is newer (last `updatedAt` wins); with
 * `replace`, local rows the server no longer has are dropped unless pending.
 */
const mergeRows = <T extends { id: string; updatedAt: string }>(
  local: T[],
  remote: T[],
  pending: ReadonlySet<string>,
  replace: boolean,
): T[] => {
  const byId = new Map(local.map((row) => [row.id, row] as const));
  const merged = remote.map((row) => {
    const mine = byId.get(row.id);
    return mine && pending.has(row.id) && mine.updatedAt > row.updatedAt ? mine : row;
  });
  const remoteIds = new Set(remote.map((row) => row.id));
  const kept = local.filter((row) => !remoteIds.has(row.id) && (!replace || pending.has(row.id)));
  return [...merged, ...kept];
};

const stampSynced = <T extends { id: string; syncedAt: string | null }>(
  rows: T[],
  id: string,
  syncedAt: string,
): T[] => rows.map((row) => (row.id === id ? { ...row, syncedAt } : row));

export class LocalStore {
  private state: StoreState;
  private listeners = new Set<Listener>();
  private changes = 0;

  constructor(
    initial: StoreState = emptyState(),
    private readonly persist: Persist | null = null,
  ) {
    this.state = initial;
  }

  /** Read-only snapshot of a table. */
  table<K extends TableName>(name: K): ReadonlyArray<Row<K>> {
    return this.state[name];
  }

  get outbox(): ReadonlyArray<OutboxEntry> {
    return this.state.outbox;
  }

  get session(): LocalSession | null {
    return this.state.session;
  }

  get prefs(): Preferences {
    return this.state.prefs;
  }

  get pulledAt(): string | null {
    return this.state.pulledAt;
  }

  /** Increments on every change so hooks can re-read derived data. */
  get version(): number {
    return this.changes;
  }

  /**
   * Upserts a record and enqueues it in the outbox atomically. The UI never
   * waits for the network: sync happens later from the outbox.
   */
  write<K extends TableName>(name: K, record: Row<K>): void {
    const entry: OutboxEntry = {
      id: uuidv7(),
      table: name,
      recordId: record.id,
      operation: "upsert",
      createdAt: nowIso(),
      attempts: 0,
      lastError: null,
      nextAttemptAt: null,
    };
    this.commit({
      ...this.state,
      [name]: upsert(this.state[name] as Row<K>[], record),
      outbox: [...this.state.outbox, entry],
    });
  }

  /**
   * Applies rows coming from the server (sync engine only): no outbox entry.
   * Only the tables present in `remote` are touched, so a pull that omits
   * `tripRoutes` leaves the local routes as they are.
   */
  applyRemote(remote: Partial<Tables>, options: { replace: boolean }): void {
    const pending = new Set(this.state.outbox.map((entry) => entry.recordId));
    let next = this.state;
    for (const name of TABLE_NAMES) {
      const rows = remote[name];
      if (!rows) continue;
      next = { ...next, [name]: mergeRows(next[name] as Row<TableName>[], rows, pending, options.replace) };
    }
    this.commit(next);
  }

  /** Stamps the server sync time on a record once the server accepted it. */
  markSynced(name: TableName, id: string, syncedAt: string): void {
    this.commit({ ...this.state, [name]: stampSynced(this.state[name] as Row<TableName>[], id, syncedAt) });
  }

  /** Marks outbox entries as delivered (sync engine only). */
  ackOutbox(ids: string[]): void {
    const done = new Set(ids);
    this.commit({ ...this.state, outbox: this.state.outbox.filter((e) => !done.has(e.id)) });
  }

  /** Drops every outbox entry of one record, whatever its retry state. */
  ackRecord(table: TableName, recordId: string): void {
    this.commit({
      ...this.state,
      outbox: this.state.outbox.filter((e) => !(e.table === table && e.recordId === recordId)),
    });
  }

  /** Records a failed delivery and when the entry may be retried. */
  failOutbox(ids: string[], error: string, nextAttemptAt: (attempts: number) => string): void {
    const failed = new Set(ids);
    this.commit({
      ...this.state,
      outbox: this.state.outbox.map((entry) =>
        failed.has(entry.id)
          ? {
              ...entry,
              attempts: entry.attempts + 1,
              lastError: error,
              nextAttemptAt: nextAttemptAt(entry.attempts + 1),
            }
          : entry,
      ),
    });
  }

  /**
   * Clears backoff so entries are retried on the next push (manual retry).
   * With a filter only the entries whose `lastError` or table matches are
   * cleared; without one, every entry is.
   */
  retryOutbox(filter?: RetryFilter): void {
    const errors = filter?.errors ? new Set(filter.errors) : null;
    const tables = filter?.tables ? new Set<TableName>(filter.tables) : null;
    const matches = (entry: OutboxEntry): boolean =>
      (errors === null || (entry.lastError !== null && errors.has(entry.lastError))) &&
      (tables === null || tables.has(entry.table));
    this.commit({
      ...this.state,
      outbox: this.state.outbox.map((entry) => (matches(entry) ? { ...entry, nextAttemptAt: null } : entry)),
    });
  }

  /**
   * Keeps local storage small: drops synced routes beyond the `keep` most
   * recent ones (by the trip's start, falling back to the route's creation).
   * Routes still waiting in the outbox are always kept.
   */
  evictRoutes(keep: number): void {
    const pending = new Set(
      this.state.outbox.filter((e) => e.table === "tripRoutes").map((e) => e.recordId),
    );
    const startedAt = new Map(this.state.trips.map((trip) => [trip.id, trip.startedAt] as const));
    const sortKey = (route: TripRoute): string => startedAt.get(route.tripId) ?? route.createdAt;
    const synced = this.state.tripRoutes
      .filter((route) => !pending.has(route.id))
      .sort((a, b) => (sortKey(a) < sortKey(b) ? 1 : sortKey(a) > sortKey(b) ? -1 : 0));
    const survivors = new Set(synced.slice(0, Math.max(0, keep)).map((route) => route.id));
    const tripRoutes = this.state.tripRoutes.filter(
      (route) => pending.has(route.id) || survivors.has(route.id),
    );
    if (tripRoutes.length === this.state.tripRoutes.length) return;
    this.commit({ ...this.state, tripRoutes });
  }

  setSession(session: LocalSession | null): void {
    this.commit({ ...this.state, session });
  }

  setPrefs(patch: Partial<Preferences>): void {
    this.commit({ ...this.state, prefs: { ...this.state.prefs, ...patch } });
  }

  setPulledAt(pulledAt: string | null): void {
    this.commit({ ...this.state, pulledAt });
  }

  /** Drops everything (sign out, or another account on this device). */
  reset(): void {
    this.commit(emptyState());
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private commit(next: StoreState): void {
    this.state = next;
    this.changes += 1;
    this.persist?.(next);
    for (const listener of this.listeners) listener();
  }
}
