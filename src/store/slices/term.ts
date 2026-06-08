import type { StateCreator } from "zustand";
import { TERM_OPTIONS, type TermOption } from "../../lib/terms";
import type { CoursesSlice } from "./courses";
import type { CurrentRegSlice } from "./currentReg";
import type { SchedulesSlice } from "./schedules";
import type { SelectionSlice } from "./selection";
import type { UiSlice } from "./ui";

const DEFAULT_TERM = "202540"; // Spring 2026 — replaced live by registration.terms.list

export interface TermSlice {
  term: string;
  /**
   * Terms shown in the picker. Seeded from the static `TERM_OPTIONS` so the
   * dropdown works before Banner responds (offline / demo / pre-login), then
   * replaced with the merged live list once `useScheduleSync` fetches.
   */
  termOptions: TermOption[];
  /**
   * Switch the active term. All per-term state wipes — including the
   * selection sets, because a `subjectCourse` key has no meaning across
   * terms (sections differ, prereqs differ, the course may not even
   * exist next semester). Only `rules` survives, since those are real
   * cross-term preferences.
   */
  setTerm: (term: string) => void;
  /** Replace the term picker options (live terms unioned with the static fallback). */
  setTermOptions: (options: TermOption[]) => void;
}

export const createTermSlice: StateCreator<
  TermSlice & CoursesSlice & CurrentRegSlice & SchedulesSlice & SelectionSlice & UiSlice,
  [],
  [],
  TermSlice
> = (set) => ({
  term: DEFAULT_TERM,
  termOptions: TERM_OPTIONS,
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
        selectedCourses: new Set(),
        sectionOverrides: new Map(),
        includedCourses: new Set(),
      };
    }),
  setTermOptions: (options) => set({ termOptions: options }),
});
