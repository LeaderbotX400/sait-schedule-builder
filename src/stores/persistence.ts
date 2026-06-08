/**
 * Shared localStorage persistence helper for Pinia stores.
 *
 * Wraps Pinia's `$subscribe` so each store can opt in to persistence
 * with a tiny `pickState` / `hydrate` pair — no plugin needed. Maps and
 * Sets are serialized as arrays via the caller's `pickState`, and
 * rebuilt via `hydrate`. Hydration is synchronous and runs immediately,
 * so the store is ready by the time any component reads it.
 */

import type { StoreGeneric } from "pinia";

export interface PersistOptions<T> {
  store: StoreGeneric;
  /** localStorage key, e.g. `sait-sb-v1:rules`. Versioned to make breaking changes safe. */
  key: string;
  /** Return the plain JSON-safe slice of state to persist. */
  pickState: () => T;
  /** Apply a previously-persisted slice back onto the store. */
  hydrate: (data: T) => void;
}

export function persistStore<T>({ store, key, pickState, hydrate }: PersistOptions<T>): void {
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw) as T;
      hydrate(parsed);
    }
  } catch {
    /* corrupted JSON or unavailable storage — start clean */
  }

  store.$subscribe(
    () => {
      try {
        localStorage.setItem(key, JSON.stringify(pickState()));
      } catch {
        /* quota / private mode — silent */
      }
    },
    { detached: true },
  );
}

/** Convenience: nuke every key matching the app's persistence prefix. */
export function clearPersistedState(prefix = "sait-sb-v1:"): void {
  if (typeof localStorage === "undefined") return;
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const key = localStorage.key(i);
    if (key?.startsWith(prefix)) localStorage.removeItem(key);
  }
}
