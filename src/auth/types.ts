export type AuthStatus = "unknown" | "unauthenticated" | "authenticated";

export interface CredentialState {
  status: AuthStatus;
  acquiredAt: number | null;
  source: string;
}

export type LoginResult = { ok: true } | { ok: false; error: string; message: string };

export const AUTH_STALE_AFTER_MS = 55 * 60 * 1000;
