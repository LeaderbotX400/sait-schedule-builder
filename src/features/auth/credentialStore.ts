import type { CredentialState, LoginResult } from "./types";

/**
 * Abstract source-of-truth for Banner credentials. The auth service
 * routes every read/write through one of these so we can swap the
 * implementation (extension cookies today; future direct-fetch possible)
 * without touching the rest of the app.
 */
export interface CredentialStore {
  readonly source: string;
  /** Read the live credential status (round-trips to the extension/SW). */
  getState(): Promise<CredentialState>;
  /** Synchronously read a previously-persisted state, if any. Used for optimistic UI on first paint. */
  readPersisted(): CredentialState | null;
  /** Subscribe to async updates pushed by the underlying credential source. */
  subscribe(fn: (s: CredentialState) => void): () => void;
  /** Start the interactive login flow. Resolves on completion or abort. */
  startLogin(opts?: { force?: boolean }): Promise<LoginResult>;
  /** Abort an in-progress login. No-op if no flow is active. */
  cancelLogin?(): void;
  /** Wipe stored credentials and notify subscribers. */
  clear(): Promise<void>;
}
