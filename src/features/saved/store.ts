import { acceptHMRUpdate, defineStore } from "pinia";
import { computed } from "vue";
import { nanoid } from "nanoid";
import type { SavedSchedule, Schedule } from "@/domain/types";
import { useTermStore } from "@/features/term/store";
import { createTermSlots } from "@/lib/termSlots";

/**
 * Saved schedule picks, term-keyed. Pure CRUD — reloading a saved
 * schedule (re-fetch, rehydrate, regenerate, best-match seek) is a
 * cross-store workflow and lives in `features/planner/actions.ts`.
 */
export const useSavedStore = defineStore(
  "saved",
  () => {
    const termStore = useTermStore();
    const s = createTermSlots<SavedSchedule[]>({
      term: () => termStore.term,
      empty: () => [],
    });

    const savedSchedules = computed<SavedSchedule[]>(() => s.active.value);

    function saveSchedule(schedule: Schedule, name?: string): void {
      const entry: SavedSchedule = {
        id: nanoid(),
        termCode: termStore.term,
        savedAt: Date.now(),
        picks: schedule.courses.map((c) => ({
          subjectCourse: c.subjectCourse,
          identifier: c.identifier,
        })),
        ...(name !== undefined ? { name } : {}),
      };
      s.update((prev) => [...prev, entry]);
    }

    function removeSaved(id: string): void {
      s.update((prev) => prev.filter((entry) => entry.id !== id));
    }

    function renameSaved(id: string, newName: string): void {
      s.update((prev) =>
        prev.map((entry) => (entry.id === id ? { ...entry, name: newName } : entry)),
      );
    }

    function setAll(next: Map<string, SavedSchedule[]>): void {
      s.setAll(next);
    }

    return { slots: s.slots, savedSchedules, saveSchedule, removeSaved, renameSaved, setAll };
  },
  {
    persist: {
      key: "saved",
      version: 1,
      pick: (store) => {
        const out: Record<string, SavedSchedule[]> = {};
        for (const [termCode, entries] of store.slots as Map<string, SavedSchedule[]>) {
          if (entries.length > 0) out[termCode] = entries;
        }
        return out;
      },
      apply: (store, data) => {
        if (typeof data !== "object" || data === null || Array.isArray(data)) return;
        const map = new Map<string, SavedSchedule[]>();
        for (const [termCode, entries] of Object.entries(data)) {
          if (Array.isArray(entries)) map.set(termCode, entries as SavedSchedule[]);
        }
        store.setAll(map);
      },
    },
  },
);

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useSavedStore, import.meta.hot));
}
