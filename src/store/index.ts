import { create } from "zustand";
import { type AuthSlice, createAuthSlice } from "./slices/auth";

// During the migration the store starts with just AuthSlice. Step 4b adds
// the rest (term, courses, selection, rules, schedules, currentReg,
// profile, ui).
export type AppState = AuthSlice;

export const useStore = create<AppState>()((...args) => ({
  ...createAuthSlice(...args),
}));

/** Stable selector for the rare consumer that wants the whole store. */
export function useAppStore<T>(selector: (s: AppState) => T): T {
  return useStore(selector);
}
