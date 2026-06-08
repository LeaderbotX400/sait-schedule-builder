/** Whether the user has a usable Banner session right now. */
export type AuthStatus = "unknown" | "unauthenticated" | "authenticated";

export interface CredentialState {
  status: AuthStatus;
  /** Wall-clock ms when the session was last verified live. */
  acquiredAt: number | null;
  /** Which `CredentialStore` produced this state (for diagnostics). */
  source: string;
}

export type LoginResult = { ok: true } | { ok: false; error: string; message: string };

/** Session age at which we flag the credentials as stale and nudge reauth. */
export const AUTH_STALE_AFTER_MS = 55 * 60 * 1000;
