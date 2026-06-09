import { resetSdk, setSessionExpiredHandler } from "@/lib/sdk";
import { isDemoMode } from "@/demo";
import type { CredentialStore } from "./credentialStore";
import { DemoCredentialStore } from "./demoStore";
import { ExtensionCookieCredentialStore } from "./extensionCookieStore";
import { useAuthStore } from "./store";
import type { CredentialState, LoginResult } from "./types";

/**
 * Owns the imperative side of auth: drives login flows, hydrates from
 * persisted state, and pushes credential updates into the auth Pinia
 * store. Lives outside the store itself so the store stays a thin
 * reactive container that the proxy + composable layer can read.
 */
export class AuthService {
  readonly store: CredentialStore;
  private subscribed = false;

  constructor(store: CredentialStore) {
    this.store = store;
  }

  /** Hydrate from persisted state, then fire a live check. Idempotent. */
  async init(): Promise<void> {
    this.ensureSubscribed();
    setSessionExpiredHandler(() => this.notifySessionExpired());

    const persisted = this.store.readPersisted();
    if (persisted) this.applyState(persisted);

    const live = await this.store.getState();
    this.applyState(live);
    useAuthStore().markLiveChecked();
  }

  /** Re-fetch live state from the credential store and apply. */
  async refresh(): Promise<void> {
    const live = await this.store.getState();
    this.applyState(live);
    useAuthStore().markLiveChecked();
  }

  login(): Promise<LoginResult> {
    return this.runLoginFlow({ force: false });
  }

  reauth(): Promise<LoginResult> {
    return this.runLoginFlow({ force: true });
  }

  async disconnect(): Promise<void> {
    await this.store.clear();
    resetSdk();
    useAuthStore().reset();
  }

  cancelLogin(): void {
    this.store.cancelLogin?.();
  }

  /** Called by the SDK proxy when a request fails with BannerSessionExpiredError. */
  notifySessionExpired(): void {
    useAuthStore().setStatus("unauthenticated", null);
  }

  private async runLoginFlow(opts: { force: boolean }): Promise<LoginResult> {
    const auth = useAuthStore();
    auth.setBusy(true);
    auth.setError(null);
    try {
      const result = await this.store.startLogin(opts);
      if (result.ok) {
        auth.setStatus("authenticated", Date.now());
        auth.markLiveChecked();
      } else {
        if (opts.force) auth.setStatus("unauthenticated", null);
        auth.setError(result.message);
      }
      return result;
    } finally {
      useAuthStore().setBusy(false);
    }
  }

  private ensureSubscribed(): void {
    if (this.subscribed) return;
    this.subscribed = true;
    this.store.subscribe((s) => this.applyState(s));
  }

  private applyState(s: CredentialState): void {
    useAuthStore().setStatus(s.status, s.acquiredAt);
  }
}

let _service: AuthService | null = null;

/** Module-level singleton — constructed on first call. */
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
