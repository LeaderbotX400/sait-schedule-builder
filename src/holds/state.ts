import { create } from "zustand";

export interface HoldsStateShape {
  count: number | null;
  busy: boolean;
  error: string | null;

  setCount: (count: number | null) => void;
  setBusy: (busy: boolean) => void;
  setError: (msg: string | null) => void;
  reset: () => void;
}

export const useHoldsState = create<HoldsStateShape>((set) => ({
  count: null,
  busy: false,
  error: null,

  setCount: (count) => set({ count }),
  setBusy: (busy) => set({ busy }),
  setError: (error) => set({ error }),
  reset: () => set({ count: null, busy: false, error: null }),
}));
