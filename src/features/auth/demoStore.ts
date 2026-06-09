import type { CredentialStore } from "./credentialStore";
import type { CredentialState, LoginResult } from "./types";

const SOURCE = "demo";

/** Always-authenticated stub used when running in demo mode. */
export class DemoCredentialStore implements CredentialStore {
  readonly source = SOURCE;
  private acquiredAt = Date.now();

  readPersisted(): CredentialState | null {
    return { status: "authenticated", acquiredAt: this.acquiredAt, source: SOURCE };
  }

  getState(): Promise<CredentialState> {
    return Promise.resolve({
      status: "authenticated",
      acquiredAt: this.acquiredAt,
      source: SOURCE,
    });
  }

  subscribe(_fn: (s: CredentialState) => void): () => void {
    return () => {};
  }

  startLogin(): Promise<LoginResult> {
    this.acquiredAt = Date.now();
    return Promise.resolve({ ok: true });
  }

  clear(): Promise<void> {
    return Promise.resolve();
  }
}
