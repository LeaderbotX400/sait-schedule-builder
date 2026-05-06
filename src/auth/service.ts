import { isDemoMode } from "../demo";
import type { CredentialStore } from "./credentialStore";
import { DemoCredentialStore } from "./demoStore";
import { ExtensionCookieCredentialStore } from "./extensionCookieStore";
import { useAuthState } from "./state";
import type { CredentialState, LoginResult } from "./types";

export class AuthService {
  readonly store: CredentialStore;
  private subscribed = false;

  constructor(store: CredentialStore) {
    this.store = store;
  }

  /** Hydrate from persisted state, then fire a live check. Idempotent. */
  async init(): Promise<void> {
    this.ensureSubscribed();

    const persisted = this.store.readPersisted();
    if (persisted) this.applyState(persisted);

    const live = await this.store.getState();
    this.applyState(live);
  }

  /** Re-fetch live state from the credential store and update internal state. */
  async refresh(): Promise<void> {
    const live = await this.store.getState();
    this.applyState(live);
  }

  async login(): Promise<LoginResult> {
    return this.runLoginFlow({ force: false });
  }

  async reauth(): Promise<LoginResult> {
    return this.runLoginFlow({ force: true });
  }

  async disconnect(): Promise<void> {
    await this.store.clear();
    useAuthState.getState().reset();
  }

  /** Called by the SDK proxy when a request fails with BannerSessionExpiredError. */
  notifySessionExpired(): void {
    useAuthState.getState().setStatus("unauthenticated", null);
  }

  private async runLoginFlow(opts: { force: boolean }): Promise<LoginResult> {
    const state = useAuthState.getState();
    state.setBusy(true);
    state.setError(null);
    try {
      const result = await this.store.startLogin(opts);
      if (result.ok) {
        useAuthState.getState().setStatus("authenticated", Date.now());
      } else {
        if (opts.force) useAuthState.getState().setStatus("unauthenticated", null);
        useAuthState.getState().setError(result.message);
      }
      return result;
    } finally {
      useAuthState.getState().setBusy(false);
    }
  }

  private ensureSubscribed(): void {
    if (this.subscribed) return;
    this.subscribed = true;
    this.store.subscribe((s) => this.applyState(s));
  }

  private applyState(s: CredentialState): void {
    useAuthState.getState().setStatus(s.status, s.acquiredAt);
  }
}

let _service: AuthService | null = null;

export function getAuthService(): AuthService {
  if (!_service) {
    const store: CredentialStore = isDemoMode()
      ? new DemoCredentialStore()
      : new ExtensionCookieCredentialStore();
    _service = new AuthService(store);
  }
  return _service;
}

/** Test hook — replaces (or clears) the singleton. */
export function _setAuthServiceForTesting(svc: AuthService | null): void {
  _service = svc;
}
