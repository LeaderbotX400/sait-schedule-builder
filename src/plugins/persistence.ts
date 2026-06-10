import type { PiniaPlugin, StoreGeneric } from "pinia";
import { migrateLegacy } from "./migrateLegacy";

/**
 * The one localStorage persistence mechanism: a Pinia plugin driven by a
 * declarative `persist` spec on each store's defineStore options.
 *
 * Every persisted value is a versioned envelope `{ v, data }` under
 * `sait-sb-v2:<key>`. Hydration runs synchronously at store creation so
 * state is ready before the first paint; writes go through a detached
 * `$subscribe`. Legacy (v1/v0) keys are translated once at plugin
 * install by `migrateLegacy`.
 */

export const STORAGE_PREFIX = "sait-sb-v2:";

interface Envelope {
  v: number;
  data: unknown;
}

export interface PersistSpec {
  /** Short name; the localStorage key becomes `sait-sb-v2:<key>`. */
  key: string;
  /** Envelope version — bump when the persisted shape changes. */
  version: number;
  /** Return the JSON-safe slice of state to persist. */
  pick(store: StoreGeneric): unknown;
  /** Apply a previously-persisted slice back onto the store. */
  apply(store: StoreGeneric, data: unknown): void;
}

declare module "pinia" {
   
  export interface DefineStoreOptionsBase<S, Store> {
    persist?: PersistSpec;
  }
}

export function createPersistencePlugin(storage?: Storage): PiniaPlugin {
  const store = storage ?? safeLocalStorage();

  if (store) migrateLegacy(store);

  return ({ store: piniaStore, options }) => {
    const spec = options.persist;
    if (!spec || !store) return;
    const fullKey = STORAGE_PREFIX + spec.key;

    try {
      const raw = store.getItem(fullKey);
      if (raw) {
        const envelope = JSON.parse(raw) as Envelope;
        if (envelope && typeof envelope === "object" && envelope.v === spec.version) {
          spec.apply(piniaStore, envelope.data);
        }
      }
    } catch {
      /* corrupted JSON or unavailable storage — start clean */
    }

    piniaStore.$subscribe(
      () => {
        try {
          const envelope: Envelope = { v: spec.version, data: spec.pick(piniaStore) };
          store.setItem(fullKey, JSON.stringify(envelope));
        } catch {
          /* quota / private mode — silent */
        }
      },
      { detached: true },
    );
  };
}

/** Convenience: nuke every key matching the app's persistence prefix. */
export function clearPersistedState(prefix = STORAGE_PREFIX): void {
  const store = safeLocalStorage();
  if (!store) return;
  for (let i = store.length - 1; i >= 0; i--) {
    const key = store.key(i);
    if (key?.startsWith(prefix)) store.removeItem(key);
  }
}

function safeLocalStorage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

// --- Codec toolbox -----------------------------------------------------
//
// Small serialize/deserialize pairs for the Map/Set shapes stores keep in
// shallowRefs. `deserialize` returns undefined for foreign shapes so a
// corrupt payload skips hydration instead of poisoning the store.

export interface PersistCodec<S, P = unknown> {
  serialize(state: S): P;
  deserialize(raw: unknown): S | undefined;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export const codecs = {
  /** `Set<string>` ⇄ `string[]` */
  stringSet(): PersistCodec<Set<string>, string[]> {
    return {
      serialize: (s) => [...s],
      deserialize: (raw) =>
        Array.isArray(raw) ? new Set(raw.filter((v) => typeof v === "string")) : undefined,
    };
  },

  /** `Map<string, string>` ⇄ `Record<string, string>` */
  stringMap(): PersistCodec<Map<string, string>, Record<string, string>> {
    return {
      serialize: (m) => Object.fromEntries(m),
      deserialize: (raw) => {
        if (!isPlainObject(raw)) return undefined;
        const out = new Map<string, string>();
        for (const [k, v] of Object.entries(raw)) {
          if (typeof v === "string") out.set(k, v);
        }
        return out;
      },
    };
  },

  /**
   * `Map<termCode, T>` ⇄ `Record<termCode, P>` via an inner slot codec.
   * Slots whose serialized form `skipEmpty` rejects are omitted, and inner
   * deserialization failures drop just that term's slot.
   */
  termSlots<T, P>(
    inner: PersistCodec<T, P>,
    opts: { skipEmpty?: (slot: T) => boolean } = {},
  ): PersistCodec<Map<string, T>, Record<string, P>> {
    return {
      serialize: (m) => {
        const out: Record<string, P> = {};
        for (const [termCode, slot] of m) {
          if (opts.skipEmpty?.(slot)) continue;
          out[termCode] = inner.serialize(slot);
        }
        return out;
      },
      deserialize: (raw) => {
        if (!isPlainObject(raw)) return undefined;
        const out = new Map<string, T>();
        for (const [termCode, slotRaw] of Object.entries(raw)) {
          const slot = inner.deserialize(slotRaw);
          if (slot !== undefined) out.set(termCode, slot);
        }
        return out;
      },
    };
  },

  /** Identity codec with an optional type guard on the way in. */
  json<T>(guard?: (v: unknown) => v is T): PersistCodec<T, T> {
    return {
      serialize: (v) => v,
      deserialize: (raw) => {
        if (raw === undefined || raw === null) return undefined;
        if (guard && !guard(raw)) return undefined;
        return raw as T;
      },
    };
  },
};
