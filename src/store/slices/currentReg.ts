import type { StateCreator } from "zustand";
import { resolveCurrentSection, sectionsHaveConflict } from "../../domain/conflicts";
import type { CourseSection, CurrentRegistration, Schedule } from "../../domain/types";
import type { CoursesSlice } from "./courses";

export interface CurrentRegSlice {
  currentRegistrations: Map<string, CurrentRegistration>;
  sectionOverrides: Map<string, string>;
  includedCourses: Set<string>;

  initializeCurrentRegistrations: (groups: Map<string, CourseSection[]>) => void;
  toggleCurrentCourse: (subjectCourse: string) => void;
  swapSection: (
    subjectCourse: string,
    newSectionId: string,
  ) => { success: boolean; conflicts: CourseSection[] };
  /** Build a `Schedule`-shaped object from the current registrations + overrides. */
  getCurrentSchedule: () => Schedule | null;
}

export const createCurrentRegSlice: StateCreator<
  CurrentRegSlice & CoursesSlice,
  [],
  [],
  CurrentRegSlice
> = (set, get) => ({
  currentRegistrations: new Map(),
  sectionOverrides: new Map(),
  includedCourses: new Set(),

  initializeCurrentRegistrations(fromCourseGroups) {
    const regs = new Map<string, CurrentRegistration>();
    const included = new Set<string>();
    for (const [subjectCourse, sections] of fromCourseGroups) {
      const currentSection = sections[0];
      if (currentSection) {
        regs.set(subjectCourse, { subjectCourse, currentSection, isIncluded: true });
        included.add(subjectCourse);
      }
    }
    set({ currentRegistrations: regs, includedCourses: included, sectionOverrides: new Map() });
  },

  toggleCurrentCourse(subjectCourse) {
    set((s) => {
      const next = new Set(s.includedCourses);
      if (next.has(subjectCourse)) next.delete(subjectCourse);
      else next.add(subjectCourse);
      return { includedCourses: next };
    });
  },

  swapSection(subjectCourse, newSectionId) {
    const { courseGroups, currentRegistrations, sectionOverrides, includedCourses } = get();
    const sections = courseGroups.get(subjectCourse);
    if (!sections) return { success: false, conflicts: [] };
    const newSection = sections.find((s) => s.identifier === newSectionId);
    if (!newSection) return { success: false, conflicts: [] };

    const conflicts: CourseSection[] = [];
    for (const course of currentRegistrations.keys()) {
      if (course === subjectCourse) continue;
      if (!includedCourses.has(course)) continue;
      const otherSection = resolveCurrentSection(
        course,
        currentRegistrations,
        sectionOverrides,
        courseGroups,
      );
      if (otherSection && sectionsHaveConflict(newSection, otherSection)) {
        conflicts.push(otherSection);
      }
    }

    set((s) => {
      const next = new Map(s.sectionOverrides);
      next.set(subjectCourse, newSectionId);
      return { sectionOverrides: next };
    });
    return { success: true, conflicts };
  },

  getCurrentSchedule() {
    const { currentRegistrations, includedCourses, sectionOverrides, courseGroups } = get();
    if (currentRegistrations.size === 0) return null;

    const courses: CourseSection[] = [];
    for (const subjectCourse of currentRegistrations.keys()) {
      if (!includedCourses.has(subjectCourse)) continue;
      const section = resolveCurrentSection(
        subjectCourse,
        currentRegistrations,
        sectionOverrides,
        courseGroups,
      );
      if (section) courses.push(section);
    }
    if (courses.length === 0) return null;

    return {
      id: 0,
      qualityScore: 0,
      warnings: [],
      courses,
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
  },
});
