import type { StateCreator } from "zustand";

export interface SelectionSlice {
  selectedCourses: Set<string>;
  toggleCourse: (subjectCourse: string) => void;
  setSelectedCourses: (next: Set<string> | ((prev: Set<string>) => Set<string>)) => void;
}

export const createSelectionSlice: StateCreator<SelectionSlice, [], [], SelectionSlice> = (
  set,
) => ({
  selectedCourses: new Set(),
  toggleCourse(subjectCourse) {
    set((s) => {
      const next = new Set(s.selectedCourses);
      if (next.has(subjectCourse)) next.delete(subjectCourse);
      else next.add(subjectCourse);
      return { selectedCourses: next };
    });
  },
  setSelectedCourses(next) {
    set((s) => ({
      selectedCourses: typeof next === "function" ? next(s.selectedCourses) : next,
    }));
  },
});
