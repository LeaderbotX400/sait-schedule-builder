import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CredentialStore } from "../credentialStore";
import { AuthService } from "../service";
import { useAuthStore } from "../store";
import type { CredentialState, LoginResult } from "../types";

interface MockStoreConfig {
  persisted?: CredentialState | null;
  initial?: CredentialState;
  loginResults?: LoginResult[];
}

function makeMockStore(config: MockStoreConfig = {}): CredentialStore & {
  emit: (s: CredentialState) => void;
  cleared: { value: boolean };
} {
  const subscribers = new Set<(s: CredentialState) => void>();
  const cleared = { value: false };
  const loginQueue = [...(config.loginResults ?? [])];
  return {
    source: "mock",
    readPersisted: () => config.persisted ?? null,
    getState: vi
      .fn()
      .mockResolvedValue(
        config.initial ?? { status: "unauthenticated", acquiredAt: null, source: "mock" },
      ),
    subscribe(fn) {
      subscribers.add(fn);
      return () => subscribers.delete(fn);
    },
    startLogin: vi.fn().mockImplementation(async () => {
      return loginQueue.shift() ?? ({ ok: true } satisfies LoginResult);
    }),
    cancelLogin: vi.fn(),
    clear: vi.fn().mockImplementation(async () => {
      cleared.value = true;
    }),
    emit(s) {
      for (const fn of subscribers) fn(s);
    },
    cleared,
  };
}

describe("AuthService", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("init applies persisted state, fires a live check, and marks liveChecked", async () => {
    const mockStore = makeMockStore({
      persisted: { status: "authenticated", acquiredAt: 123, source: "mock" },
      initial: { status: "authenticated", acquiredAt: 456, source: "mock" },
    });
    const service = new AuthService(mockStore);

    await service.init();

    const auth = useAuthStore();
    expect(auth.status).toBe("authenticated");
    expect(auth.acquiredAt).toBe(456);
    expect(auth.liveChecked).toBe(true);
  });

  it("login success transitions to authenticated and clears busy", async () => {
    const mockStore = makeMockStore({
      loginResults: [{ ok: true }],
    });
    const service = new AuthService(mockStore);

    const result = await service.login();

    const auth = useAuthStore();
    expect(result.ok).toBe(true);
    expect(auth.status).toBe("authenticated");
    expect(auth.busy).toBe(false);
    expect(auth.lastError).toBeNull();
  });

  it("login failure records the error message and clears busy", async () => {
    const mockStore = makeMockStore({
      loginResults: [{ ok: false, error: "TIMEOUT", message: "Login timed out" }],
    });
    const service = new AuthService(mockStore);

    const result = await service.login();

    const auth = useAuthStore();
    expect(result.ok).toBe(false);
    expect(auth.busy).toBe(false);
    expect(auth.lastError).toBe("Login timed out");
  });

  it("reauth failure flips status to unauthenticated (force=true)", async () => {
    const mockStore = makeMockStore({
      persisted: { status: "authenticated", acquiredAt: 100, source: "mock" },
      initial: { status: "authenticated", acquiredAt: 100, source: "mock" },
      loginResults: [{ ok: false, error: "FAIL", message: "Could not reauth" }],
    });
    const service = new AuthService(mockStore);
    await service.init();

    const auth = useAuthStore();
    expect(auth.status).toBe("authenticated");

    await service.reauth();

    expect(auth.status).toBe("unauthenticated");
    expect(auth.acquiredAt).toBeNull();
    expect(auth.lastError).toBe("Could not reauth");
  });

  it("disconnect clears the credential store and resets the auth store", async () => {
    const mockStore = makeMockStore({
      initial: { status: "authenticated", acquiredAt: 100, source: "mock" },
    });
    const service = new AuthService(mockStore);
    await service.init();

    await service.disconnect();

    const auth = useAuthStore();
    expect(mockStore.cleared.value).toBe(true);
    expect(auth.status).toBe("unauthenticated");
    expect(auth.acquiredAt).toBeNull();
  });

  it("notifySessionExpired transitions the store to unauthenticated", () => {
    const mockStore = makeMockStore({});
    const service = new AuthService(mockStore);
    useAuthStore().setStatus("authenticated", 100);

    service.notifySessionExpired();

    expect(useAuthStore().status).toBe("unauthenticated");
    expect(useAuthStore().acquiredAt).toBeNull();
  });

  it("subscribes once — external updates push into the auth store", async () => {
    const mockStore = makeMockStore({});
    const service = new AuthService(mockStore);
    await service.init();

    mockStore.emit({ status: "authenticated", acquiredAt: 999, source: "mock" });

    const auth = useAuthStore();
    expect(auth.status).toBe("authenticated");
    expect(auth.acquiredAt).toBe(999);
  });
});
