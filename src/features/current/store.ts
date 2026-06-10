import { acceptHMRUpdate, defineStore } from "pinia";
import { computed } from "vue";
import { resolveCurrentSection, sectionsHaveConflict } from "@/domain/conflicts";
import type { CourseSection, CurrentRegistration, Schedule } from "@/domain/types";
import { useTermStore } from "@/features/term/store";
import { createTermSlots } from "@/lib/termSlots";
import { codecs, type PersistCodec } from "@/plugins/persistence";

export interface CurrentRegSlot {
  currentRegistrations: Map<string, CurrentRegistration>;
  sectionOverrides: Map<string, string>;
  includedCourses: Set<string>;
}

function makeEmptySlot(): CurrentRegSlot {
  return {
    currentRegistrations: new Map(),
    sectionOverrides: new Map(),
    includedCourses: new Set(),
  };
}

/**
 * Only overrides + inclusion survive reloads; registrations themselves
 * are re-fetched from Banner on sync.
 */
const slotCodec: PersistCodec<
  CurrentRegSlot,
  { overrides: Record<string, string>; included: string[] }
> = {
  serialize: (slot) => ({
    overrides: Object.fromEntries(slot.sectionOverrides),
    included: [...slot.includedCourses],
  }),
  deserialize: (raw) => {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return undefined;
    const obj = raw as { overrides?: unknown; included?: unknown };
    return {
      currentRegistrations: new Map(),
      sectionOverrides: codecs.stringMap().deserialize(obj.overrides ?? {}) ?? new Map(),
      includedCourses: codecs.stringSet().deserialize(obj.included ?? []) ?? new Set(),
    };
  },
};

const slotsCodec = codecs.termSlots(slotCodec, {
  skipEmpty: (slot) => slot.sectionOverrides.size === 0 && slot.includedCourses.size === 0,
});

/**
 * Per-term current-registration state. Each term owns its own slot:
 * the registrations Banner reported plus any pending swaps the user
 * has staged. For future planning terms the registrations map will be
 * empty (no live enrolment), but `sectionOverrides` and
 * `includedCourses` can still be staged and persisted.
 *
 * Methods that need the course catalog take it as a parameter — the
 * planner actions pass it in, so this store never reads other stores.
 */
export const useCurrentRegStore = defineStore(
  "current",
  () => {
    const termStore = useTermStore();
    const s = createTermSlots<CurrentRegSlot>({
      term: () => termStore.term,
      empty: makeEmptySlot,
    });

    const currentRegistrations = computed(() => s.active.value.currentRegistrations);
    const sectionOverrides = computed(() => s.active.value.sectionOverrides);
    const includedCourses = computed(() => s.active.value.includedCourses);

    function initializeFromGroups(fromCourseGroups: Map<string, CourseSection[]>): void {
      const regs = new Map<string, CurrentRegistration>();
      const included = new Set<string>();
      for (const [subjectCourse, sections] of fromCourseGroups) {
        const currentSection = sections[0];
        if (!currentSection) continue;
        regs.set(subjectCourse, { subjectCourse, currentSection, isIncluded: true });
        included.add(subjectCourse);
      }
      // Replace registrations + includedCourses for the active term, but
      // preserve any persisted sectionOverrides so a user's staged swap
      // survives a Banner refresh.
      s.update((prev) => ({
        currentRegistrations: regs,
        sectionOverrides: prev.sectionOverrides,
        includedCourses: included,
      }));
    }

    function toggleCurrentCourse(subjectCourse: string): void {
      s.update((prev) => {
        const included = new Set(prev.includedCourses);
        if (included.has(subjectCourse)) included.delete(subjectCourse);
        else included.add(subjectCourse);
        return { ...prev, includedCourses: included };
      });
    }

    /**
     * Stage a section swap. Returns the list of other registrations that
     * would conflict, but still records the override — the UI prompts the
     * user with the conflicts and can roll back with another swap call.
     */
    function swapSection(
      subjectCourse: string,
      newSectionId: string,
      catalog: Map<string, CourseSection[]>,
    ): { success: boolean; conflicts: CourseSection[] } {
      const sections = catalog.get(subjectCourse);
      if (!sections) return { success: false, conflicts: [] };
      const newSection = sections.find((sec) => sec.identifier === newSectionId);
      if (!newSection) return { success: false, conflicts: [] };

      const slot = s.active.value;
      const conflicts: CourseSection[] = [];
      for (const otherCourse of slot.currentRegistrations.keys()) {
        if (otherCourse === subjectCourse) continue;
        if (!slot.includedCourses.has(otherCourse)) continue;
        const otherSection = resolveCurrentSection(
          otherCourse,
          slot.currentRegistrations,
          slot.sectionOverrides,
          catalog,
        );
        if (otherSection && sectionsHaveConflict(newSection, otherSection)) {
          conflicts.push(otherSection);
        }
      }

      s.update((prev) => {
        const sectionOverrides = new Map(prev.sectionOverrides);
        sectionOverrides.set(subjectCourse, newSectionId);
        return { ...prev, sectionOverrides };
      });

      return { success: true, conflicts };
    }

    /** Build a `Schedule`-shaped object from the active-term registrations + overrides. */
    function getCurrentSchedule(catalog: Map<string, CourseSection[]>): Schedule | null {
      const slot = s.active.value;
      if (slot.currentRegistrations.size === 0) return null;

      const selected: CourseSection[] = [];
      for (const subjectCourse of slot.currentRegistrations.keys()) {
        if (!slot.includedCourses.has(subjectCourse)) continue;
        const section = resolveCurrentSection(
          subjectCourse,
          slot.currentRegistrations,
          slot.sectionOverrides,
          catalog,
        );
        if (section) selected.push(section);
      }
      if (selected.length === 0) return null;

      return {
        id: 0,
        qualityScore: 0,
        warnings: [],
        courses: selected,
        daysUsed: [],
        daysCount: 0,
        onCampusDays: [],
        onCampusDaysCount: 0,
        onCampusPerDay: {},
        earlyMorningPenalty: 0,
        travelTimePenalty: 0,
        isPartial: false,
        omittedCourses: [],
        blockoutFitScore: 0,
      };
    }

    /** Drop one course from the active-term slot. */
    function forgetCourse(subjectCourse: string): void {
      s.update((prev) => {
        const inReg = prev.currentRegistrations.has(subjectCourse);
        const inInc = prev.includedCourses.has(subjectCourse);
        const inOv = prev.sectionOverrides.has(subjectCourse);
        if (!inReg && !inInc && !inOv) return prev;

        const next: CurrentRegSlot = {
          currentRegistrations: inReg
            ? new Map(prev.currentRegistrations)
            : prev.currentRegistrations,
          includedCourses: inInc ? new Set(prev.includedCourses) : prev.includedCourses,
          sectionOverrides: inOv ? new Map(prev.sectionOverrides) : prev.sectionOverrides,
        };
        if (inReg) next.currentRegistrations.delete(subjectCourse);
        if (inInc) next.includedCourses.delete(subjectCourse);
        if (inOv) next.sectionOverrides.delete(subjectCourse);
        return next;
      });
    }

    /**
     * Drop sectionOverrides whose identifier is no longer offered in the
     * supplied catalog. Returns the list of subjectCourses whose override
     * was discarded so the caller can surface a "section swapped" warning.
     */
    function reconcileOverrides(
      catalog: Map<string, CourseSection[]>,
    ): { subjectCourse: string; fromIdentifier: string }[] {
      const slot = s.active.value;
      if (slot.sectionOverrides.size === 0) return [];
      const dropped: { subjectCourse: string; fromIdentifier: string }[] = [];
      const nextOverrides = new Map<string, string>();
      for (const [course, overrideId] of slot.sectionOverrides) {
        const sections = catalog.get(course);
        if (sections?.some((sec) => sec.identifier === overrideId)) {
          nextOverrides.set(course, overrideId);
        } else if (sections) {
          // Course still exists, just not that section.
          dropped.push({ subjectCourse: course, fromIdentifier: overrideId });
        }
        // If the course is gone entirely the override silently drops;
        // the caller will surface a `course-dropped` warning instead.
      }
      if (nextOverrides.size !== slot.sectionOverrides.size) {
        s.update((prev) => ({ ...prev, sectionOverrides: nextOverrides }));
      }
      return dropped;
    }

    function clearCurrentReg(): void {
      s.write(termStore.term, makeEmptySlot());
    }

    function setAll(next: Map<string, CurrentRegSlot>): void {
      s.setAll(next);
    }

    return {
      slots: s.slots,
      currentRegistrations,
      sectionOverrides,
      includedCourses,
      initializeFromGroups,
      toggleCurrentCourse,
      swapSection,
      getCurrentSchedule,
      forgetCourse,
      reconcileOverrides,
      clearCurrentReg,
      setAll,
    };
  },
  {
    persist: {
      key: "current",
      version: 1,
      pick: (store) => slotsCodec.serialize(store.slots as Map<string, CurrentRegSlot>),
      apply: (store, data) => {
        const slots = slotsCodec.deserialize(data);
        if (slots) store.setAll(slots);
      },
    },
  },
);

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useCurrentRegStore, import.meta.hot));
}
