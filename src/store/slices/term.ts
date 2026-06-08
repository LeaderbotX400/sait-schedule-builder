import type { StateCreator } from "zustand";
import type { CoursesSlice } from "./courses";
import type { CurrentRegSlice } from "./currentReg";
import type { SchedulesSlice } from "./schedules";
import type { UiSlice } from "./ui";

const DEFAULT_TERM = "202540"; // Spring 2026 — replaced live by registration.terms.list

export interface TermSlice {
  term: string;
  /**
   * Switch the active term. Course data is per-term ephemeral state (search
   * results, current registrations, generated schedules), so we wipe it on
   * change and let useScheduleSync reload for the new term. Persisted user
   * preferences (rules, selectedCourses, includedCourses, sectionOverrides)
   * stay — they're cross-term choices.
   */
  setTerm: (term: string) => void;
}

export const createTermSlice: StateCreator<
  TermSlice & CoursesSlice & CurrentRegSlice & SchedulesSlice & UiSlice,
  [],
  [],
  TermSlice
> = (set) => ({
  term: DEFAULT_TERM,
  setTerm: (term) =>
    set((s) => {
      if (s.term === term) return s;
      return {
        term,
        courseGroups: new Map(),
        schedules: [],
        activeScheduleIndex: 0,
        generationStatus: { kind: "idle" } as const,
        currentRegistrations: new Map(),
        loadError: null,
      };
    }),
});
