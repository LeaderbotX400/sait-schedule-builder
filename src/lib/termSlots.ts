import { computed, type ComputedRef, shallowRef, type ShallowRef } from "vue";

/**
 * Per-term slot state: a `Map<termCode, T>` held in a `shallowRef` and
 * replaced wholesale on every mutation, with the active term's slot
 * exposed as a computed. This is the one implementation of the pattern
 * the per-term stores (catalog, selection, current, saved) share —
 * switching terms swaps which slot is visible without wiping anything.
 */
export interface TermSlots<T> {
  slots: ShallowRef<ReadonlyMap<string, T>>;
  /** The active term's slot; a reference-stable empty value when missing. */
  active: ComputedRef<T>;
  get(termCode: string): T;
  /** Replace one term's slot (immutable Map replacement). */
  write(termCode: string, next: T): void;
  /** Update a slot through a pure function; defaults to the active term. */
  update(updater: (prev: T) => T, termCode?: string): void;
  /** Delete one term's slot, or the active term's when omitted. */
  clear(termCode?: string): void;
  /** Replace the whole map — the hydration entry point. */
  setAll(next: Map<string, T>): void;
}

export interface CreateTermSlotsOptions<T> {
  /** Reads the active term code — usually `() => useTermStore().term`. */
  term: () => string;
  /** Builds the empty slot value; called once and cached as a stable singleton. */
  empty: () => T;
}

export function createTermSlots<T>(opts: CreateTermSlotsOptions<T>): TermSlots<T> {
  const slots = shallowRef<ReadonlyMap<string, T>>(new Map());
  const EMPTY = opts.empty();

  const active = computed<T>(() => slots.value.get(opts.term()) ?? EMPTY);

  function get(termCode: string): T {
    return slots.value.get(termCode) ?? EMPTY;
  }

  function write(termCode: string, next: T): void {
    const map = new Map(slots.value);
    map.set(termCode, next);
    slots.value = map;
  }

  function update(updater: (prev: T) => T, termCode?: string): void {
    const code = termCode ?? opts.term();
    write(code, updater(get(code)));
  }

  function clear(termCode?: string): void {
    const code = termCode ?? opts.term();
    if (!slots.value.has(code)) return;
    const map = new Map(slots.value);
    map.delete(code);
    slots.value = map;
  }

  function setAll(next: Map<string, T>): void {
    slots.value = next;
  }

  return { slots, active, get, write, update, clear, setAll };
}
