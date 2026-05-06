import { create } from "zustand";

export interface IdentityStateShape {
  studentId: string | null;
  busy: boolean;
  error: string | null;

  setStudentId: (id: string | null) => void;
  setBusy: (busy: boolean) => void;
  setError: (msg: string | null) => void;
  reset: () => void;
}

export const useIdentityState = create<IdentityStateShape>((set) => ({
  studentId: null,
  busy: false,
  error: null,

  setStudentId: (studentId) => set({ studentId }),
  setBusy: (busy) => set({ busy }),
  setError: (error) => set({ error }),
  reset: () => set({ studentId: null, busy: false, error: null }),
}));
