import { create } from "zustand";
import { AUTH_STALE_AFTER_MS, type AuthStatus } from "./types";

export interface AuthStateShape {
  status: AuthStatus;
  acquiredAt: number | null;
  lastError: string | null;
  busy: boolean;
  /** Bumped by a low-frequency ticker so age-derived selectors re-render. */
  tick: number;

  setStatus: (status: AuthStatus, acquiredAt?: number | null) => void;
  setBusy: (busy: boolean) => void;
  setError: (msg: string | null) => void;
  bumpTick: () => void;
  reset: () => void;
}

export const useAuthState = create<AuthStateShape>((set) => ({
  status: "unknown",
  acquiredAt: null,
  lastError: null,
  busy: false,
  tick: 0,

  setStatus: (status, acquiredAt) =>
    set((s) => ({
      status,
      acquiredAt: status === "authenticated" ? (acquiredAt ?? s.acquiredAt ?? Date.now()) : null,
    })),
  setBusy: (busy) => set({ busy }),
  setError: (lastError) => set({ lastError }),
  bumpTick: () => set((s) => ({ tick: s.tick + 1 })),
  reset: () => set({ status: "unauthenticated", acquiredAt: null, lastError: null, busy: false }),
}));

export function selectSessionAgeSeconds(s: AuthStateShape): number {
  if (s.acquiredAt == null) return 0;
  // Touch tick so subscribers re-render when the ticker bumps.
  void s.tick;
  return Math.floor((Date.now() - s.acquiredAt) / 1000);
}

export function selectIsStale(s: AuthStateShape): boolean {
  if (s.status !== "authenticated" || s.acquiredAt == null) return false;
  void s.tick;
  return Date.now() - s.acquiredAt >= AUTH_STALE_AFTER_MS;
}
