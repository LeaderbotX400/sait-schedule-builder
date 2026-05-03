import type { StateCreator } from "zustand";

const DEFAULT_TERM = "202540"; // Spring 2026 — replaced live by registration.terms.list

export interface TermSlice {
  term: string;
  setTerm: (term: string) => void;
}

export const createTermSlice: StateCreator<TermSlice, [], [], TermSlice> = (set) => ({
  term: DEFAULT_TERM,
  setTerm: (term) => set({ term }),
});
