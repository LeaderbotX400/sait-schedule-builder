import { acceptHMRUpdate, defineStore } from "pinia";
import { computed, shallowRef } from "vue";
import { resolveCurrentSection, sectionsHaveConflict } from "@/domain/conflicts";
import type { CourseSection, CurrentRegistration, Schedule } from "@/domain/types";
import { useCoursesStore } from "@/features/courses/store";
import { useTermStore } from "@/features/term/store";
import { persistStore } from "@/lib/persistence";

interface CurrentRegSlot {
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
 * Per-term current-registration state. Each term owns its own slot:
 * the registrations Banner reported plus any pending swaps the user
 * has staged. For future planning terms the registrations map will be
 * empty (no live enrolment), but `sectionOverrides` and
 * `includedCourses` can still be staged and persisted.
 */
export const useCurrentRegStore = defineStore("currentReg", () => {
  const termStore = useTermStore();
  const slots = shallowRef<Map<string, CurrentRegSlot>>(new Map());

  /** Stable singletons for missing-slot reads so reference equality holds. */
  const EMPTY = makeEmptySlot();

  function getSlot(termCode: string): CurrentRegSlot {
    return slots.value.get(termCode) ?? EMPTY;
  }

  const currentRegistrations = computed(() => getSlot(termStore.term).currentRegistrations);
  const sectionOverrides = computed(() => getSlot(termStore.term).sectionOverrides);
  const includedCourses = computed(() => getSlot(termStore.term).includedCourses);

  function writeSlot(termCode: string, next: CurrentRegSlot): void {
    const map = new Map(slots.value);
    map.set(termCode, next);
    slots.value = map;
  }

  function patchSlot(termCode: string, patch: Partial<CurrentRegSlot>): void {
    const cur = slots.value.get(termCode) ?? makeEmptySlot();
    writeSlot(termCode, { ...cur, ...patch });
  }

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
    const prev = slots.value.get(termStore.term) ?? makeEmptySlot();
    writeSlot(termStore.term, {
      currentRegistrations: regs,
      sectionOverrides: prev.sectionOverrides,
      includedCourses: included,
    });
  }

  function toggleCurrentCourse(subjectCourse: string): void {
    const slot = getSlot(termStore.term);
    const next = new Set(slot.includedCourses);
    if (next.has(subjectCourse)) next.delete(subjectCourse);
    else next.add(subjectCourse);
    patchSlot(termStore.term, { includedCourses: next });
  }

  /**
   * Stage a section swap. Returns the list of other registrations that
   * would conflict, but still records the override — the UI prompts the
   * user with the conflicts and can roll back with another swap call.
   */
  function swapSection(
    subjectCourse: string,
    newSectionId: string,
  ): { success: boolean; conflicts: CourseSection[] } {
    const courses = useCoursesStore();
    const sections = courses.courseGroups.get(subjectCourse);
    if (!sections) return { success: false, conflicts: [] };
    const newSection = sections.find((s) => s.identifier === newSectionId);
    if (!newSection) return { success: false, conflicts: [] };

    const slot = getSlot(termStore.term);
    const conflicts: CourseSection[] = [];
    for (const otherCourse of slot.currentRegistrations.keys()) {
      if (otherCourse === subjectCourse) continue;
      if (!slot.includedCourses.has(otherCourse)) continue;
      const otherSection = resolveCurrentSection(
        otherCourse,
        slot.currentRegistrations,
        slot.sectionOverrides,
        courses.courseGroups,
      );
      if (otherSection && sectionsHaveConflict(newSection, otherSection)) {
        conflicts.push(otherSection);
      }
    }

    const nextOverrides = new Map(slot.sectionOverrides);
    nextOverrides.set(subjectCourse, newSectionId);
    patchSlot(termStore.term, { sectionOverrides: nextOverrides });

    return { success: true, conflicts };
  }

  /** Build a `Schedule`-shaped object from the active-term registrations + overrides. */
  function getCurrentSchedule(): Schedule | null {
    const slot = getSlot(termStore.term);
    if (slot.currentRegistrations.size === 0) return null;
    const courses = useCoursesStore();

    const selected: CourseSection[] = [];
    for (const subjectCourse of slot.currentRegistrations.keys()) {
      if (!slot.includedCourses.has(subjectCourse)) continue;
      const section = resolveCurrentSection(
        subjectCourse,
        slot.currentRegistrations,
        slot.sectionOverrides,
        courses.courseGroups,
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

  /** Drop one course from the active-term slot (called by coursesStore.removeCourse). */
  function forgetCourse(subjectCourse: string): void {
    const slot = getSlot(termStore.term);
    const inReg = slot.currentRegistrations.has(subjectCourse);
    const inInc = slot.includedCourses.has(subjectCourse);
    const inOv = slot.sectionOverrides.has(subjectCourse);
    if (!inReg && !inInc && !inOv) return;

    const next: CurrentRegSlot = {
      currentRegistrations: inReg ? new Map(slot.currentRegistrations) : slot.currentRegistrations,
      includedCourses: inInc ? new Set(slot.includedCourses) : slot.includedCourses,
      sectionOverrides: inOv ? new Map(slot.sectionOverrides) : slot.sectionOverrides,
    };
    if (inReg) next.currentRegistrations.delete(subjectCourse);
    if (inInc) next.includedCourses.delete(subjectCourse);
    if (inOv) next.sectionOverrides.delete(subjectCourse);

    writeSlot(termStore.term, next);
  }

  /**
   * Drop sectionOverrides whose identifier is no longer offered in the
   * supplied catalog. Returns the list of subjectCourses whose override
   * was discarded so the caller can surface a "section swapped" warning.
   */
  function reconcileOverrides(
    catalog: Map<string, CourseSection[]>,
  ): { subjectCourse: string; fromIdentifier: string }[] {
    const slot = getSlot(termStore.term);
    if (slot.sectionOverrides.size === 0) return [];
    const dropped: { subjectCourse: string; fromIdentifier: string }[] = [];
    const nextOverrides = new Map<string, string>();
    for (const [course, overrideId] of slot.sectionOverrides) {
      const sections = catalog.get(course);
      if (sections?.some((s) => s.identifier === overrideId)) {
        nextOverrides.set(course, overrideId);
      } else if (sections) {
        // Course still exists, just not that section.
        dropped.push({ subjectCourse: course, fromIdentifier: overrideId });
      }
      // If the course is gone entirely the override silently drops;
      // the caller will surface a `course-dropped` warning instead.
    }
    if (nextOverrides.size !== slot.sectionOverrides.size) {
      patchSlot(termStore.term, { sectionOverrides: nextOverrides });
    }
    return dropped;
  }

  function clearCurrentReg(): void {
    writeSlot(termStore.term, makeEmptySlot());
  }

  function setSlots(next: Map<string, CurrentRegSlot>): void {
    slots.value = next;
  }

  return {
    slots,
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
    setSlots,
  };
});

const NEW_KEY = "sait-sb-v1:currentRegSlots";
const LEGACY_KEY = "sait-sb-v1:currentReg";

interface PersistedSlot {
  sectionOverrides: [string, string][];
  includedCourses: string[];
}

/**
 * Persist sectionOverrides + includedCourses per term. Registrations
 * themselves are re-fetched from Banner on sync, so we omit them.
 */
export function persistCurrentRegStore(): void {
  // One-shot migration of the pre-slot key onto the active term.
  if (typeof localStorage !== "undefined" && localStorage.getItem(NEW_KEY) === null) {
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      try {
        const parsed = JSON.parse(legacy);
        if (parsed && typeof parsed === "object") {
          const activeTerm = useTermStore().term;
          const slot: PersistedSlot = {
            sectionOverrides: Array.isArray(parsed.sectionOverrides) ? parsed.sectionOverrides : [],
            includedCourses: Array.isArray(parsed.includedCourses) ? parsed.includedCourses : [],
          };
          if (slot.sectionOverrides.length > 0 || slot.includedCourses.length > 0) {
            localStorage.setItem(NEW_KEY, JSON.stringify({ [activeTerm]: slot }));
          }
        }
      } catch {
        /* corrupt legacy — ignore */
      }
    }
  }

  const store = useCurrentRegStore();
  persistStore({
    store,
    key: NEW_KEY,
    pickState: () => {
      const out: Record<string, PersistedSlot> = {};
      for (const [termCode, slot] of store.slots) {
        if (slot.sectionOverrides.size === 0 && slot.includedCourses.size === 0) continue;
        out[termCode] = {
          sectionOverrides: [...slot.sectionOverrides.entries()],
          includedCourses: [...slot.includedCourses],
        };
      }
      return out;
    },
    hydrate: (data) => {
      if (!data || typeof data !== "object" || Array.isArray(data)) return;
      const map = new Map<string, CurrentRegSlot>();
      for (const [termCode, rawSlot] of Object.entries(data as Record<string, unknown>)) {
        if (!rawSlot || typeof rawSlot !== "object") continue;
        const slot = rawSlot as Partial<PersistedSlot>;
        map.set(termCode, {
          currentRegistrations: new Map(),
          sectionOverrides: Array.isArray(slot.sectionOverrides)
            ? new Map(slot.sectionOverrides)
            : new Map(),
          includedCourses: Array.isArray(slot.includedCourses)
            ? new Set(slot.includedCourses)
            : new Set(),
        });
      }
      store.setSlots(map);
    },
  });
}

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useCurrentRegStore, import.meta.hot));
}
