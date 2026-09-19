import { seed } from "./seed";
import { LocalStore } from "./store";

/** Single local store instance for the app session. */
let store: LocalStore | null = null;

export const getStore = (): LocalStore => {
  if (!store) store = new LocalStore(seed);
  return store;
};
