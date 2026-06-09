import { acceptHMRUpdate, defineStore } from "pinia";
import { computed, shallowRef } from "vue";
import { persistStore } from "@/lib/persistence";
import { useTermStore } from "@/features/term/store";

/**
 * Per-term selection of `subjectCourse` keys. Each term owns its own
 * slot, so the user can plan a future term (e.g. Fall 2026), switch
 * back to the live registration term, and return without losing the
 * picks. The active slot is exposed as `selectedCourses`; mutations
 * target the active slot.
 */
export const useSelectionStore = defineStore("selection", () => {
  const termStore = useTermStore();
  const slots = shallowRef<Map<string, Set<string>>>(new Map());

  /** Stable empty value so `computed` returns reference-equal Sets between reads on missing slots. */
  const EMPTY: Set<string> = new Set();

  const selectedCourses = computed<Set<string>>(
    () => slots.value.get(termStore.term) ?? EMPTY,
  );

  function writeSlot(termCode: string, next: Set<string>): void {
    const map = new Map(slots.value);
    map.set(termCode, next);
    slots.value = map;
  }

  function setSelectedCourses(
    next: Set<string> | ((prev: Set<string>) => Set<string>),
  ): void {
    const prev = slots.value.get(termStore.term) ?? EMPTY;
    const resolved = typeof next === "function" ? next(prev) : next;
    writeSlot(termStore.term, resolved);
  }

  function toggleCourse(subjectCourse: string): void {
    const prev = slots.value.get(termStore.term) ?? EMPTY;
    const nextSet = new Set(prev);
    if (nextSet.has(subjectCourse)) nextSet.delete(subjectCourse);
    else nextSet.add(subjectCourse);
    writeSlot(termStore.term, nextSet);
  }

  function setSlots(next: Map<string, Set<string>>): void {
    slots.value = next;
  }

  return {
    slots,
    selectedCourses,
    setSelectedCourses,
    toggleCourse,
    setSlots,
  };
});

const NEW_KEY = "sait-sb-v1:selectionSlots";
const LEGACY_KEY = "sait-sb-v1:selectedCourses";

export function persistSelectionStore(): void {
  // One-shot migration: if pre-slot key exists and new key doesn't,
  // attribute the legacy selection to the currently-active term.
  // termStore is persisted+hydrated before this runs (see main.ts).
  if (typeof localStorage !== "undefined" && localStorage.getItem(NEW_KEY) === null) {
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      try {
        const arr = JSON.parse(legacy);
        if (Array.isArray(arr) && arr.length > 0) {
          const activeTerm = useTermStore().term;
          localStorage.setItem(NEW_KEY, JSON.stringify({ [activeTerm]: arr }));
        }
      } catch {
        /* corrupt legacy — ignore */
      }
    }
  }

  const store = useSelectionStore();
  persistStore({
    store,
    key: NEW_KEY,
    pickState: () => {
      const out: Record<string, string[]> = {};
      for (const [termCode, set] of store.slots) {
        if (set.size > 0) out[termCode] = [...set];
      }
      return out;
    },
    hydrate: (data) => {
      if (!data || typeof data !== "object" || Array.isArray(data)) return;
      const map = new Map<string, Set<string>>();
      for (const [termCode, arr] of Object.entries(data as Record<string, unknown>)) {
        if (Array.isArray(arr)) map.set(termCode, new Set(arr.filter((v) => typeof v === "string")));
      }
      store.setSlots(map);
    },
  });
}

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useSelectionStore, import.meta.hot));
}
