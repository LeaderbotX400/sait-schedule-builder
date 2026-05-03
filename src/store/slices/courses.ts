import type { StateCreator } from "zustand";
import type { BannerResponse } from "../../banner-sdk/apps/registration/types";
import { parseBannerData } from "../../domain/parser";
import type { CourseSection } from "../../domain/types";
import type { CurrentRegSlice } from "./currentReg";
import type { SchedulesSlice } from "./schedules";
import type { SelectionSlice } from "./selection";
import type { UiSlice } from "./ui";

export interface CoursesSlice {
  courseGroups: Map<string, CourseSection[]>;
  setCourseGroups: (groups: Map<string, CourseSection[]>) => void;
  /**
   * Merge a Banner search response into the existing course groups; also
   * adds the new subjectCourse keys to selectedCourses and resets the
   * generated-schedules slice. Returns count of new sections.
   */
  loadBannerResponse: (response: BannerResponse) => number;
  /**
   * Drop a single course from courseGroups + every dependent slice
   * (selection, currentReg, sectionOverrides, includedCourses) so the
   * planner stops considering it. Re-running search adds it back.
   */
  removeCourse: (subjectCourse: string) => void;
  clearCourses: () => void;
}

export const createCoursesSlice: StateCreator<
  CoursesSlice & CurrentRegSlice & SchedulesSlice & SelectionSlice & UiSlice,
  [],
  [],
  CoursesSlice
> = (set, get) => ({
  courseGroups: new Map(),

  setCourseGroups(groups) {
    set({ courseGroups: groups });
  },

  loadBannerResponse(response) {
    if (!response.data || response.data.length === 0) {
      get().setLoadError(
        "Banner returned no course sections. Double-check that the course codes exist for the selected term.",
      );
      return 0;
    }
    const newGroups = parseBannerData(response);
    if (newGroups.size === 0) {
      get().setLoadError("Received data but no valid course sections could be parsed.");
      return 0;
    }
    set((s) => {
      const merged = new Map(s.courseGroups);
      for (const [name, sections] of newGroups) merged.set(name, sections);
      const nextSelected = new Set(s.selectedCourses);
      for (const name of newGroups.keys()) nextSelected.add(name);
      return {
        courseGroups: merged,
        selectedCourses: nextSelected,
        schedules: [],
        activeScheduleIndex: 0,
        generationStatus: { kind: "idle" } as const,
      };
    });
    get().setLoadError(null);
    return response.data.length;
  },

  removeCourse(subjectCourse) {
    set((s) => {
      if (!s.courseGroups.has(subjectCourse)) return s;
      const courseGroups = new Map(s.courseGroups);
      courseGroups.delete(subjectCourse);
      const selectedCourses = new Set(s.selectedCourses);
      selectedCourses.delete(subjectCourse);
      const includedCourses = new Set(s.includedCourses);
      includedCourses.delete(subjectCourse);
      const sectionOverrides = new Map(s.sectionOverrides);
      sectionOverrides.delete(subjectCourse);
      const currentRegistrations = new Map(s.currentRegistrations);
      currentRegistrations.delete(subjectCourse);
      return {
        courseGroups,
        selectedCourses,
        includedCourses,
        sectionOverrides,
        currentRegistrations,
        // Drop generated schedules — the input changed.
        schedules: [],
        activeScheduleIndex: 0,
        generationStatus: { kind: "idle" } as const,
      };
    });
  },

  clearCourses() {
    set({
      courseGroups: new Map(),
      selectedCourses: new Set(),
      schedules: [],
      activeScheduleIndex: 0,
      generationStatus: { kind: "idle" } as const,
      currentRegistrations: new Map(),
      includedCourses: new Set(),
      sectionOverrides: new Map(),
    });
    get().setLoadError(null);
  },
});
