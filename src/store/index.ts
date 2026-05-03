import { create } from "zustand";
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

export const useStore = create<AppState>()((...args) => ({
  ...createAuthSlice(...args),
  ...createTermSlice(...args),
  ...createCoursesSlice(...args),
  ...createSelectionSlice(...args),
  ...createRulesSlice(...args),
  ...createSchedulesSlice(...args),
  ...createCurrentRegSlice(...args),
  ...createUiSlice(...args),
}));

/** Stable selector for the rare consumer that wants the whole store. */
export function useAppStore<T>(selector: (s: AppState) => T): T {
  return useStore(selector);
}

export type { GenerationStatus } from "./slices/schedules";
