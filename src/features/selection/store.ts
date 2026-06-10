import { acceptHMRUpdate, defineStore } from "pinia";
import { computed } from "vue";
import { useTermStore } from "@/features/term/store";
import { createTermSlots } from "@/lib/termSlots";
import { codecs, type PersistCodec } from "@/plugins/persistence";

/**
 * Per-term planner input: which courses are selected, and which
 * sections are pinned. Each term owns its own slot, so the user can
 * plan a future term, switch back, and return without losing picks.
 *
 * A pin locks a specific CRN for a subjectCourse so the scheduler only
 * generates schedules containing that exact section.
 */
export interface SelectionSlot {
  courses: Set<string>;
  pinned: Map<string, string>;
}

const slotCodec: PersistCodec<SelectionSlot, { courses: string[]; pinned: Record<string, string> }> = {
  serialize: (slot) => ({
    courses: [...slot.courses],
    pinned: Object.fromEntries(slot.pinned),
  }),
  deserialize: (raw) => {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return undefined;
    const obj = raw as { courses?: unknown; pinned?: unknown };
    const courses = codecs.stringSet().deserialize(obj.courses ?? []) ?? new Set<string>();
    const pinned = codecs.stringMap().deserialize(obj.pinned ?? {}) ?? new Map<string, string>();
    return { courses, pinned };
  },
};

const slotsCodec = codecs.termSlots(slotCodec, {
  skipEmpty: (slot) => slot.courses.size === 0 && slot.pinned.size === 0,
});

export const useSelectionStore = defineStore(
  "selection",
  () => {
    const termStore = useTermStore();
    const s = createTermSlots<SelectionSlot>({
      term: () => termStore.term,
      empty: () => ({ courses: new Set(), pinned: new Map() }),
    });

    const selectedCourses = computed<Set<string>>(() => s.active.value.courses);
    const pinnedSections = computed<Map<string, string>>(() => s.active.value.pinned);

    function setSelectedCourses(
      next: Set<string> | ((prev: Set<string>) => Set<string>),
    ): void {
      s.update((prev) => ({
        ...prev,
        courses: typeof next === "function" ? next(prev.courses) : next,
      }));
    }

    function toggleCourse(subjectCourse: string): void {
      setSelectedCourses((prev) => {
        const next = new Set(prev);
        if (next.has(subjectCourse)) next.delete(subjectCourse);
        else next.add(subjectCourse);
        return next;
      });
    }

    /** Drop a course from both the selection and its pin, if present. */
    function forgetCourse(subjectCourse: string): void {
      s.update((prev) => {
        if (!prev.courses.has(subjectCourse) && !prev.pinned.has(subjectCourse)) return prev;
        const courses = new Set(prev.courses);
        courses.delete(subjectCourse);
        const pinned = new Map(prev.pinned);
        pinned.delete(subjectCourse);
        return { courses, pinned };
      });
    }

    function pin(subjectCourse: string, crn: string): void {
      s.update((prev) => {
        const pinned = new Map(prev.pinned);
        pinned.set(subjectCourse, crn);
        return { ...prev, pinned };
      });
    }

    function unpin(subjectCourse: string): void {
      s.update((prev) => {
        if (!prev.pinned.has(subjectCourse)) return prev;
        const pinned = new Map(prev.pinned);
        pinned.delete(subjectCourse);
        return { ...prev, pinned };
      });
    }

    function clearPins(): void {
      s.update((prev) => (prev.pinned.size === 0 ? prev : { ...prev, pinned: new Map() }));
    }

    function setAll(next: Map<string, SelectionSlot>): void {
      s.setAll(next);
    }

    return {
      slots: s.slots,
      selectedCourses,
      pinnedSections,
      setSelectedCourses,
      toggleCourse,
      forgetCourse,
      pin,
      unpin,
      clearPins,
      setAll,
    };
  },
  {
    persist: {
      key: "selection",
      version: 1,
      pick: (store) => slotsCodec.serialize(store.slots as Map<string, SelectionSlot>),
      apply: (store, data) => {
        const slots = slotsCodec.deserialize(data);
        if (slots) store.setAll(slots);
      },
    },
  },
);

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useSelectionStore, import.meta.hot));
}
