import type { StateCreator } from "zustand";

export interface AuthSlice {
  isLoggedIn: boolean;
  setLoggedIn: (v: boolean) => void;
}

export const createAuthSlice: StateCreator<AuthSlice, [], [], AuthSlice> = (set) => ({
  isLoggedIn: false,
  setLoggedIn: (v) => set({ isLoggedIn: v }),
});
