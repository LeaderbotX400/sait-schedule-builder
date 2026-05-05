import { create } from "zustand";
import { createJSONStorage, type PersistOptions, persist } from "zustand/middleware";
import { isDemoMode } from "../demo";
import { type AuthSlice, createAuthSlice } from "./slices/auth";
import { type CoursesSlice, createCoursesSlice } from "./slices/courses";
import { type CurrentRegSlice, createCurrentRegSlice } from "./slices/currentReg";
import { createRulesSlice, type RulesSlice } from "./slices/rules";
import { createSchedulesSlice, type SchedulesSlice } from "./slices/schedules";
import { createSelectionSlice, type SelectionSlice } from "./slices/selection";
import { createTermSlice, type TermSlice } from "./slices/term";
import { createUiSlice, type UiSlice } from "./slices/ui";

export type AppState = AuthSlice &
  TermSlice &
  CoursesSlice &
  SelectionSlice &
  RulesSlice &
  SchedulesSlice &
  CurrentRegSlice &
  UiSlice;

interface PersistedShape {
  rules: AppState["rules"];
  term: AppState["term"];
  selectedCourses: string[];
  sectionOverrides: [string, string][];
  includedCourses: string[];
}

const persistOptions: PersistOptions<AppState, PersistedShape> = {
  name: isDemoMode() ? "sait-sb-demo-v1" : "sait-sb-v1",
  storage: createJSONStorage(() => localStorage),
  version: 1,
  partialize: (s) => ({
    rules: s.rules,
    term: s.term,
    selectedCourses: [...s.selectedCourses],
    sectionOverrides: [...s.sectionOverrides.entries()],
    includedCourses: [...s.includedCourses],
  }),
  merge: (persisted, current) => {
    if (!persisted || typeof persisted !== "object") return current;
    const p = persisted as Partial<PersistedShape>;
    return {
      ...current,
      ...(p.rules ? { rules: p.rules } : {}),
      ...(p.term ? { term: p.term } : {}),
      selectedCourses: new Set(p.selectedCourses ?? []),
      sectionOverrides: new Map(p.sectionOverrides ?? []),
      includedCourses: new Set(p.includedCourses ?? []),
    };
  },
};

export const useStore = create<AppState>()(
  persist(
    (...args) => ({
      ...createAuthSlice(...args),
      ...createTermSlice(...args),
      ...createCoursesSlice(...args),
      ...createSelectionSlice(...args),
      ...createRulesSlice(...args),
      ...createSchedulesSlice(...args),
      ...createCurrentRegSlice(...args),
      ...createUiSlice(...args),
    }),
    persistOptions,
  ),
);

export function useAppStore<T>(selector: (s: AppState) => T): T {
  return useStore(selector);
}

export type { GenerationStatus } from "./slices/schedules";
