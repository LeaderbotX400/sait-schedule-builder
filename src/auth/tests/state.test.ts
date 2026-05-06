import { afterEach, describe, expect, it } from "vitest";
import { selectIsStale, selectSessionAgeSeconds, useAuthState } from "../state";
import { AUTH_STALE_AFTER_MS } from "../types";

afterEach(() => {
  useAuthState.getState().reset();
});

describe("auth state", () => {
  it("setStatus(authenticated) defaults acquiredAt to now", () => {
    const before = Date.now();
    useAuthState.getState().setStatus("authenticated");
    const { acquiredAt } = useAuthState.getState();
    expect(acquiredAt).not.toBeNull();
    expect(acquiredAt as number).toBeGreaterThanOrEqual(before);
  });

  it("setStatus(unauthenticated) clears acquiredAt", () => {
    useAuthState.getState().setStatus("authenticated", Date.now());
    useAuthState.getState().setStatus("unauthenticated");
    expect(useAuthState.getState().acquiredAt).toBeNull();
  });

  it("setStatus preserves acquiredAt when re-setting authenticated without explicit value", () => {
    const t = Date.now() - 5000;
    useAuthState.getState().setStatus("authenticated", t);
    useAuthState.getState().setStatus("authenticated");
    expect(useAuthState.getState().acquiredAt).toBe(t);
  });

  it("selectSessionAgeSeconds returns 0 when not authenticated", () => {
    expect(selectSessionAgeSeconds(useAuthState.getState())).toBe(0);
  });

  it("selectSessionAgeSeconds reflects age in seconds", () => {
    useAuthState.getState().setStatus("authenticated", Date.now() - 30_000);
    expect(selectSessionAgeSeconds(useAuthState.getState())).toBeGreaterThanOrEqual(29);
  });

  it("selectIsStale flips true past the threshold", () => {
    useAuthState.getState().setStatus("authenticated", Date.now() - AUTH_STALE_AFTER_MS - 1000);
    expect(selectIsStale(useAuthState.getState())).toBe(true);
  });

  it("selectIsStale is false for fresh sessions", () => {
    useAuthState.getState().setStatus("authenticated", Date.now());
    expect(selectIsStale(useAuthState.getState())).toBe(false);
  });
});
