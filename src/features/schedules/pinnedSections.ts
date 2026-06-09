import { acceptHMRUpdate, defineStore } from "pinia";
import { computed, shallowRef } from "vue";
import { persistStore } from "@/lib/persistence";
import { useTermStore } from "@/features/term/store";

/**
 * Per-term pinned section slots. A pin locks a specific CRN for a
 * subjectCourse so the scheduler only generates schedules that include
 * that exact section. Slot-keyed by term so switching terms preserves
 * each term's pins independently.
 */
export const usePinnedSectionsStore = defineStore("pinnedSections", () => {
  const termStore = useTermStore();
  const slots = shallowRef<Map<string, Map<string, string>>>(new Map());

  const EMPTY: Map<string, string> = new Map();

  const pinnedSections = computed<Map<string, string>>(
    () => slots.value.get(termStore.term) ?? EMPTY,
  );

  function writeSlot(termCode: string, next: Map<string, string>): void {
    const map = new Map(slots.value);
    map.set(termCode, next);
    slots.value = map;
  }

  function pin(subjectCourse: string, crn: string): void {
    const current = slots.value.get(termStore.term) ?? EMPTY;
    const next = new Map(current);
    next.set(subjectCourse, crn);
    writeSlot(termStore.term, next);
  }

  function unpin(subjectCourse: string): void {
    const current = slots.value.get(termStore.term);
    if (!current?.has(subjectCourse)) return;
    const next = new Map(current);
    next.delete(subjectCourse);
    writeSlot(termStore.term, next);
  }

  function clearPins(): void {
    const map = new Map(slots.value);
    map.delete(termStore.term);
    slots.value = map;
  }

  function setSlots(next: Map<string, Map<string, string>>): void {
    slots.value = next;
  }

  return { slots, pinnedSections, pin, unpin, clearPins, setSlots };
});

export function persistPinnedSectionsStore(): void {
  const store = usePinnedSectionsStore();
  persistStore({
    store,
    key: "sait-sb-v1:pinnedSections",
    pickState: () => {
      const out: Record<string, Record<string, string>> = {};
      for (const [termCode, map] of store.slots) {
        if (map.size > 0) out[termCode] = Object.fromEntries(map);
      }
      return out;
    },
    hydrate: (data) => {
      if (!data || typeof data !== "object" || Array.isArray(data)) return;
      const next = new Map<string, Map<string, string>>();
      for (const [termCode, obj] of Object.entries(data as Record<string, unknown>)) {
        if (obj && typeof obj === "object" && !Array.isArray(obj)) {
          next.set(termCode, new Map(Object.entries(obj as Record<string, string>)));
        }
      }
      store.setSlots(next);
    },
  });
}

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(usePinnedSectionsStore, import.meta.hot));
}
