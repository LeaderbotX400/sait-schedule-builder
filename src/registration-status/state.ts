import { create } from "zustand";
import type { RegistrationNoticesResponse } from "../banner-sdk/apps/selfService/types";

export interface RegistrationStatusStateShape {
  notices: RegistrationNoticesResponse | null;
  busy: boolean;
  error: string | null;

  setNotices: (n: RegistrationNoticesResponse | null) => void;
  setBusy: (busy: boolean) => void;
  setError: (msg: string | null) => void;
  reset: () => void;
}

export const useRegistrationStatusState = create<RegistrationStatusStateShape>((set) => ({
  notices: null,
  busy: false,
  error: null,

  setNotices: (notices) => set({ notices }),
  setBusy: (busy) => set({ busy }),
  setError: (error) => set({ error }),
  reset: () => set({ notices: null, busy: false, error: null }),
}));
