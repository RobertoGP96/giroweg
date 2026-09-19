/**
 * Local data store. On the web this is an in-memory store seeded with
 * fixtures; it exposes the same contract the SQLite/Drizzle layer will
 * implement (tables + outbox written in one transaction). Only feature
 * repositories may import it.
 */
import type {
  Expense,
  MaintenanceEvent,
  MaintenanceRule,
  Reading,
  Trip,
  Vehicle,
} from "@giroweg/shared/schemas";
import { nowIso, uuidv7 } from "@/lib/id";

export interface OutboxEntry {
  id: string;
  table: keyof Tables;
  recordId: string;
  operation: "upsert";
  createdAt: string;
  attempts: number;
  lastError: string | null;
}

export interface Tables {
  vehicles: Vehicle[];
  readings: Reading[];
  trips: Trip[];
  expenses: Expense[];
  maintenanceRules: MaintenanceRule[];
  maintenanceEvents: MaintenanceEvent[];
}

export interface StoreState extends Tables {
  outbox: OutboxEntry[];
}

type Listener = () => void;

export class LocalStore {
  private state: StoreState;
  private listeners = new Set<Listener>();

  constructor(seed: Tables) {
    this.state = { ...seed, outbox: [] };
  }

  /** Read-only snapshot of a table. */
  table<K extends keyof Tables>(name: K): ReadonlyArray<Tables[K][number]> {
    return this.state[name];
  }

  get outbox(): ReadonlyArray<OutboxEntry> {
    return this.state.outbox;
  }

  /**
   * Upserts a record and enqueues it in the outbox atomically. The UI never
   * waits for the network: sync happens later from the outbox.
   */
  write<K extends keyof Tables>(name: K, record: Tables[K][number]): void {
    const rows = this.state[name] as Array<Tables[K][number]>;
    const index = rows.findIndex((row) => row.id === record.id);
    const nextRows = index === -1 ? [...rows, record] : rows.map((row, i) => (i === index ? record : row));
    const entry: OutboxEntry = {
      id: uuidv7(),
      table: name,
      recordId: record.id,
      operation: "upsert",
      createdAt: nowIso(),
      attempts: 0,
      lastError: null,
    };
    this.state = {
      ...this.state,
      [name]: nextRows,
      outbox: [...this.state.outbox, entry],
    };
    this.emit();
  }

  /** Marks outbox entries as delivered (called by the sync engine only). */
  ackOutbox(ids: string[]): void {
    const done = new Set(ids);
    this.state = { ...this.state, outbox: this.state.outbox.filter((e) => !done.has(e.id)) };
    this.emit();
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(): void {
    for (const listener of this.listeners) listener();
  }
}
