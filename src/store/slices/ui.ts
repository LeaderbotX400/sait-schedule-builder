import type { StateCreator } from "zustand";

/**
 * Transient UI state that doesn't fit into a feature-specific slice.
 * Not persisted — every reload starts with no error / not loading.
 */
export interface UiSlice {
  loadError: string | null;
  registrationsLoading: boolean;
  authRequired: boolean;
  setLoadError: (error: string | null) => void;
  setRegistrationsLoading: (loading: boolean) => void;
  setAuthRequired: (required: boolean) => void;
}

export const createUiSlice: StateCreator<UiSlice, [], [], UiSlice> = (set) => ({
  loadError: null,
  registrationsLoading: false,
  authRequired: false,
  setLoadError: (error) => set({ loadError: error }),
  setRegistrationsLoading: (loading) => set({ registrationsLoading: loading }),
  setAuthRequired: (required) => set({ authRequired: required }),
});
