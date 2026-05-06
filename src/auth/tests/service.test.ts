import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CredentialStore } from "../credentialStore";
import { AuthService } from "../service";
import { useAuthState } from "../state";
import type { CredentialState, LoginResult } from "../types";

class FakeStore implements CredentialStore {
  readonly source = "fake";
  state: CredentialState = { status: "unauthenticated", acquiredAt: null, source: "fake" };
  persisted: CredentialState | null = null;
  loginResult: LoginResult = { ok: true };
  listeners = new Set<(s: CredentialState) => void>();
  startLoginCalls: { force?: boolean }[] = [];

  readPersisted(): CredentialState | null {
    return this.persisted;
  }

  getState(): Promise<CredentialState> {
    return Promise.resolve(this.state);
  }

  subscribe(fn: (s: CredentialState) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  async startLogin(opts?: { force?: boolean }): Promise<LoginResult> {
    this.startLoginCalls.push(opts ?? {});
    return this.loginResult;
  }

  clear = vi.fn(async () => {});
}

beforeEach(() => {
  useAuthState.getState().reset();
});

afterEach(() => {
  useAuthState.getState().reset();
});

describe("AuthService", () => {
  it("init() hydrates from persisted state, then applies live state", async () => {
    const store = new FakeStore();
    store.persisted = { status: "authenticated", acquiredAt: 1000, source: "fake" };
    store.state = { status: "authenticated", acquiredAt: 2000, source: "fake" };
    const svc = new AuthService(store);

    await svc.init();

    expect(useAuthState.getState().status).toBe("authenticated");
    expect(useAuthState.getState().acquiredAt).toBe(2000);
  });

  it("login() success sets status=authenticated", async () => {
    const store = new FakeStore();
    const svc = new AuthService(store);
    const result = await svc.login();
    expect(result.ok).toBe(true);
    expect(useAuthState.getState().status).toBe("authenticated");
    expect(store.startLoginCalls[0]).toEqual({ force: false });
  });

  it("login() failure records the error", async () => {
    const store = new FakeStore();
    store.loginResult = { ok: false, error: "X", message: "boom" };
    const svc = new AuthService(store);
    const result = await svc.login();
    expect(result.ok).toBe(false);
    expect(useAuthState.getState().lastError).toBe("boom");
    expect(useAuthState.getState().busy).toBe(false);
  });

  it("reauth() passes force=true and on failure resets status", async () => {
    const store = new FakeStore();
    useAuthState.getState().setStatus("authenticated", Date.now());
    store.loginResult = { ok: false, error: "X", message: "boom" };
    const svc = new AuthService(store);
    await svc.reauth();
    expect(store.startLoginCalls[0]).toEqual({ force: true });
    expect(useAuthState.getState().status).toBe("unauthenticated");
  });

  it("disconnect() clears the credential store and resets state", async () => {
    const store = new FakeStore();
    useAuthState.getState().setStatus("authenticated", Date.now());
    const svc = new AuthService(store);
    await svc.disconnect();
    expect(store.clear).toHaveBeenCalled();
    expect(useAuthState.getState().status).toBe("unauthenticated");
  });

  it("notifySessionExpired() flips status without touching the credential store", () => {
    const store = new FakeStore();
    useAuthState.getState().setStatus("authenticated", Date.now());
    const svc = new AuthService(store);
    svc.notifySessionExpired();
    expect(useAuthState.getState().status).toBe("unauthenticated");
    expect(store.clear).not.toHaveBeenCalled();
  });

  it("subscribes to async credential-store updates after init", async () => {
    const store = new FakeStore();
    const svc = new AuthService(store);
    await svc.init();
    for (const fn of store.listeners) {
      fn({ status: "unauthenticated", acquiredAt: null, source: "fake" });
    }
    expect(useAuthState.getState().status).toBe("unauthenticated");
  });
});
