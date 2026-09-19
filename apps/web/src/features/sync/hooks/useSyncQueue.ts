"use client";

import { useSyncExternalStore } from "react";
import { getStore } from "@/db/client";
import type { OutboxEntry } from "@/db/store";

const subscribe = (callback: () => void) => getStore().subscribe(callback);
const getSnapshot = () => getStore().outbox;
const EMPTY: ReadonlyArray<OutboxEntry> = [];
const getServerSnapshot = (): ReadonlyArray<OutboxEntry> => EMPTY;

/** Pending outbox entries. The UI always shows the sync state of records. */
export const useSyncQueue = (): ReadonlyArray<OutboxEntry> =>
  useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
