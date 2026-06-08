import { createPinia, setActivePinia } from "pinia";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { effectScope, nextTick } from "vue";
import { useAuthStore } from "../../auth/store";
import { createBannerSdk } from "../../banner-sdk/facade";
import { MockTransport } from "../../banner-sdk/transport/mock";
import { _setSdkForTesting } from "../../lib/sdk";
import { useIdentityStore } from "../store";
import { useIdentity } from "../useIdentity";

/**
 * Spec for the identity composable. Drives auth-store transitions while
 * the composable runs inside an effectScope so its watcher fires, then
 * asserts what landed in the identity store. The pattern here is the
 * template for testing every other side-effect composable.
 */

function makeSdkWith(handler: () => string | null): void {
  const transport = new MockTransport().on("/getBannerId", () => {
    const bannerId = handler();
    return {
      ok: true,
      status: 200,
      contentType: "application/json",
      body: bannerId == null ? "{}" : JSON.stringify({ bannerId }),
    };
  });
  _setSdkForTesting(createBannerSdk(transport));
}

describe("useIdentity", () => {
  let scope: ReturnType<typeof effectScope>;

  beforeEach(() => {
    setActivePinia(createPinia());
    scope = effectScope();
  });

  afterEach(() => {
    scope.stop();
    _setSdkForTesting(null);
  });

  it("fetches studentId once auth is both authenticated and live-checked", async () => {
    makeSdkWith(() => "000123456");
    const auth = useAuthStore();
    const identity = useIdentityStore();

    // Seed authenticated-but-not-live BEFORE mounting so the immediate
    // watcher fire skips the SDK call.
    auth.setStatus("authenticated", Date.now());

    scope.run(() => {
      useIdentity();
    });
    await flushAsync();
    expect(identity.studentId).toBeNull();

    auth.markLiveChecked();
    await flushAsync();
    expect(identity.studentId).toBe("000123456");
  });

  it("records lastError when validateLogin rejects the credentials", async () => {
    makeSdkWith(() => null);
    const auth = useAuthStore();
    const identity = useIdentityStore();

    scope.run(() => {
      useIdentity();
    });
    auth.setStatus("authenticated", Date.now());
    auth.markLiveChecked();
    await flushAsync();

    expect(identity.studentId).toBeNull();
    expect(identity.lastError).not.toBeNull();
  });

  it("clears identity state on logout", async () => {
    makeSdkWith(() => "000123456");
    const auth = useAuthStore();
    const identity = useIdentityStore();

    scope.run(() => {
      useIdentity();
    });
    auth.setStatus("authenticated", Date.now());
    auth.markLiveChecked();
    await flushAsync();
    expect(identity.studentId).toBe("000123456");

    auth.setStatus("unauthenticated", null);
    await flushAsync();
    expect(identity.studentId).toBeNull();
  });

  it("discards a late SDK response when the scope unmounts mid-flight", async () => {
    let resolveFetch: ((bannerId: string) => void) | null = null;
    const transport = new MockTransport().on("/getBannerId", () => {
      return new Promise((resolve) => {
        resolveFetch = (id) =>
          resolve({
            ok: true,
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ bannerId: id }),
          });
      });
    });
    _setSdkForTesting(createBannerSdk(transport));

    const auth = useAuthStore();
    const identity = useIdentityStore();

    scope.run(() => {
      useIdentity();
    });
    auth.setStatus("authenticated", Date.now());
    auth.markLiveChecked();
    await nextTick();

    // Unmount BEFORE the SDK responds; the in-flight result must be dropped.
    scope.stop();
    resolveFetch?.("000999999");
    await flushAsync();

    expect(identity.studentId).toBeNull();
  });
});

/** Drain enough microtasks for the watcher + the SDK promise chain to settle. */
async function flushAsync(): Promise<void> {
  for (let i = 0; i < 8; i++) {
    await nextTick();
    await Promise.resolve();
  }
}
