import type { StateCreator } from "zustand";
import { TERM_OPTIONS, type TermOption } from "../../lib/terms";
import type { CoursesSlice } from "./courses";
import type { CurrentRegSlice } from "./currentReg";
import type { SchedulesSlice } from "./schedules";
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
   * Switch the active term. Course data is per-term ephemeral state (search
   * results, current registrations, generated schedules), so we wipe it on
   * change and let useScheduleSync reload for the new term. Persisted user
   * preferences (rules, selectedCourses, includedCourses, sectionOverrides)
   * stay — they're cross-term choices.
   */
  setTerm: (term: string) => void;
  /** Replace the term picker options (live terms unioned with the static fallback). */
  setTermOptions: (options: TermOption[]) => void;
}

export const createTermSlice: StateCreator<
  TermSlice & CoursesSlice & CurrentRegSlice & SchedulesSlice & UiSlice,
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
      };
    }),
  setTermOptions: (options) => set({ termOptions: options }),
});
