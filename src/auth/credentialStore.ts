import type { CredentialState, LoginResult } from "./types";

export interface CredentialStore {
  readonly source: string;
  /** Read the live credential status. */
  getState(): Promise<CredentialState>;
  /** Synchronously read a previously-persisted state, if any. Used for optimistic UI on first paint. */
  readPersisted(): CredentialState | null;
  /** Subscribe to async updates pushed by the underlying credential source. */
  subscribe(fn: (s: CredentialState) => void): () => void;
  /** Start the interactive login flow. Resolves on completion or abort. */
  startLogin(opts?: { force?: boolean }): Promise<LoginResult>;
  /** Abort an in-progress login (disconnects the SW port). No-op if no flow active. */
  cancelLogin?(): void;
  /** Wipe stored credentials. */
  clear(): Promise<void>;
}
