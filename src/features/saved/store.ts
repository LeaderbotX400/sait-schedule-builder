import { acceptHMRUpdate, defineStore } from "pinia";
import { computed, shallowRef } from "vue";
import { nanoid } from "nanoid";
import { parseBannerData } from "@/domain/parser";
import type { SavedSchedule, SavedSchedulePick, Schedule } from "@/domain/types";
import { useCoursesStore } from "@/features/courses/store";
import { useSchedulesStore } from "@/features/schedules/store";
import { useSelectionStore } from "@/features/selection/store";
import { useTermStore } from "@/features/term/store";
import { useUiStore } from "@/features/ui-state/store";
import { persistStore } from "@/lib/persistence";
import { getSdk } from "@/lib/sdk";

export const useSavedStore = defineStore("saved", () => {
  const termStore = useTermStore();
  const slots = shallowRef<Map<string, SavedSchedule[]>>(new Map());

  const savedSchedules = computed<SavedSchedule[]>(
    () => slots.value.get(termStore.term) ?? [],
  );

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
    const current = slots.value.get(termStore.term) ?? [];
    const map = new Map(slots.value);
    map.set(termStore.term, [...current, entry]);
    slots.value = map;
  }

  function removeSaved(id: string): void {
    const current = slots.value.get(termStore.term) ?? [];
    const next = current.filter((s) => s.id !== id);
    const map = new Map(slots.value);
    map.set(termStore.term, next);
    slots.value = map;
  }

  function renameSaved(id: string, newName: string): void {
    const current = slots.value.get(termStore.term) ?? [];
    const next = current.map((s) => (s.id === id ? { ...s, name: newName } : s));
    const map = new Map(slots.value);
    map.set(termStore.term, next);
    slots.value = map;
  }

  async function loadSaved(saved: SavedSchedule): Promise<void> {
    try {
      if (saved.termCode !== termStore.term) {
        useTermStore().setTerm(saved.termCode);
      }

      const result = await getSdk().registration.search.byCourses(
        saved.picks.map((p) => p.subjectCourse),
        saved.termCode,
      );

      const groups = parseBannerData(result.response);

      const validSelection = new Set<string>();
      for (const pick of saved.picks) {
        if (groups.has(pick.subjectCourse)) validSelection.add(pick.subjectCourse);
      }

      useCoursesStore().setCourseGroups(groups);
      useSelectionStore().setSelectedCourses(validSelection);

      useSchedulesStore().generate();

      setTimeout(() => {
        const schedulesStore = useSchedulesStore();
        const generated = schedulesStore.schedules;
        const pickSet = new Set(saved.picks.map((p) => p.identifier));
        let bestIndex = 0;
        let bestCount = -1;
        for (let i = 0; i < generated.length; i++) {
          const sched = generated[i]!;
          const count = sched.courses.filter((c) => pickSet.has(c.identifier)).length;
          if (count > bestCount) {
            bestCount = count;
            bestIndex = i;
          }
        }
        schedulesStore.setActiveScheduleIndex(bestIndex);
      }, 50);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      useUiStore().setLoadError("Could not load saved schedule: " + message);
    }
  }

  function setSlots(next: Map<string, SavedSchedule[]>): void {
    slots.value = next;
  }

  return {
    slots,
    savedSchedules,
    saveSchedule,
    removeSaved,
    renameSaved,
    loadSaved,
    setSlots,
  };
});

export function persistSavedSchedulesStore(): void {
  const store = useSavedStore();
  persistStore({
    store,
    key: "sait-sb-v1:savedSchedules",
    pickState: () => {
      const out: Record<string, Array<{ id: string; termCode: string; name?: string; savedAt: number; picks: SavedSchedulePick[] }>> = {};
      for (const [termCode, entries] of store.slots) {
        if (entries.length > 0) out[termCode] = entries;
      }
      return out;
    },
    hydrate: (data) => {
      if (!data || typeof data !== "object" || Array.isArray(data)) return;
      const map = new Map<string, SavedSchedule[]>();
      for (const [termCode, entries] of Object.entries(data as Record<string, unknown>)) {
        if (!Array.isArray(entries)) continue;
        map.set(termCode, entries as SavedSchedule[]);
      }
      store.setSlots(map);
    },
  });
}

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useSavedStore, import.meta.hot));
}
