import { defineStore } from "pinia";
import { shallowRef } from "vue";
import { resolveCurrentSection, sectionsHaveConflict } from "@/domain/conflicts";
import type { CourseSection, CurrentRegistration, Schedule } from "@/domain/types";
import { useCoursesStore } from "@/features/courses/store";
import { persistStore } from "@/lib/persistence";

/**
 * Tracks the student's currently-registered sections plus any
 * pending swaps the user has staged in the planner. `includedCourses`
 * is the set of courses to display on the Current tab; toggling
 * controls whether a course participates in conflict checks.
 */
export const useCurrentRegStore = defineStore("currentReg", () => {
  const currentRegistrations = shallowRef<Map<string, CurrentRegistration>>(new Map());
  const sectionOverrides = shallowRef<Map<string, string>>(new Map());
  const includedCourses = shallowRef<Set<string>>(new Set());

  function initializeFromGroups(fromCourseGroups: Map<string, CourseSection[]>): void {
    const regs = new Map<string, CurrentRegistration>();
    const included = new Set<string>();
    for (const [subjectCourse, sections] of fromCourseGroups) {
      const currentSection = sections[0];
      if (!currentSection) continue;
      regs.set(subjectCourse, { subjectCourse, currentSection, isIncluded: true });
      included.add(subjectCourse);
    }
    currentRegistrations.value = regs;
    includedCourses.value = included;
    sectionOverrides.value = new Map();
  }

  function toggleCurrentCourse(subjectCourse: string): void {
    const next = new Set(includedCourses.value);
    if (next.has(subjectCourse)) next.delete(subjectCourse);
    else next.add(subjectCourse);
    includedCourses.value = next;
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

    const conflicts: CourseSection[] = [];
    for (const otherCourse of currentRegistrations.value.keys()) {
      if (otherCourse === subjectCourse) continue;
      if (!includedCourses.value.has(otherCourse)) continue;
      const otherSection = resolveCurrentSection(
        otherCourse,
        currentRegistrations.value,
        sectionOverrides.value,
        courses.courseGroups,
      );
      if (otherSection && sectionsHaveConflict(newSection, otherSection)) {
        conflicts.push(otherSection);
      }
    }

    const next = new Map(sectionOverrides.value);
    next.set(subjectCourse, newSectionId);
    sectionOverrides.value = next;

    return { success: true, conflicts };
  }

  /** Build a `Schedule`-shaped object from the current registrations + overrides. */
  function getCurrentSchedule(): Schedule | null {
    if (currentRegistrations.value.size === 0) return null;
    const courses = useCoursesStore();

    const selected: CourseSection[] = [];
    for (const subjectCourse of currentRegistrations.value.keys()) {
      if (!includedCourses.value.has(subjectCourse)) continue;
      const section = resolveCurrentSection(
        subjectCourse,
        currentRegistrations.value,
        sectionOverrides.value,
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

  /** Drop one course from every tracked structure (called by coursesStore.removeCourse). */
  function forgetCourse(subjectCourse: string): void {
    if (currentRegistrations.value.has(subjectCourse)) {
      const regs = new Map(currentRegistrations.value);
      regs.delete(subjectCourse);
      currentRegistrations.value = regs;
    }
    if (includedCourses.value.has(subjectCourse)) {
      const inc = new Set(includedCourses.value);
      inc.delete(subjectCourse);
      includedCourses.value = inc;
    }
    if (sectionOverrides.value.has(subjectCourse)) {
      const ov = new Map(sectionOverrides.value);
      ov.delete(subjectCourse);
      sectionOverrides.value = ov;
    }
  }

  function clearCurrentReg(): void {
    currentRegistrations.value = new Map();
    sectionOverrides.value = new Map();
    includedCourses.value = new Set();
  }

  return {
    currentRegistrations,
    sectionOverrides,
    includedCourses,
    initializeFromGroups,
    toggleCurrentCourse,
    swapSection,
    getCurrentSchedule,
    forgetCourse,
    clearCurrentReg,
  };
});

/** Persist sectionOverrides + includedCourses. Registrations themselves are re-fetched from Banner on sync. */
export function persistCurrentRegStore(): void {
  const store = useCurrentRegStore();
  persistStore({
    store,
    key: "sait-sb-v1:currentReg",
    pickState: () => ({
      sectionOverrides: [...store.sectionOverrides.entries()],
      includedCourses: [...store.includedCourses],
    }),
    hydrate: (data) => {
      if (data && typeof data === "object") {
        if (Array.isArray(data.sectionOverrides)) {
          store.sectionOverrides = new Map(data.sectionOverrides);
        }
        if (Array.isArray(data.includedCourses)) {
          store.includedCourses = new Set(data.includedCourses);
        }
      }
    },
  });
}
