import { createPinia, setActivePinia } from "pinia";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { effectScope, nextTick } from "vue";
import { createBannerSdk } from "@/banner-sdk/facade";
import { MockTransport } from "@/banner-sdk/transport/mock";
import { _setSdkForTesting } from "@/lib/sdk";
import { useAuthStore } from "../store";
import { useAuthInit } from "../useAuthInit";

/**
 * Spec for the studentId fold (the old identity feature, now part of
 * auth): useAuthInit resolves the Banner-level studentId via
 * validateLogin once the session is live-checked authenticated, and
 * clears it on logout.
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

async function flushAsync(): Promise<void> {
  await nextTick();
  await new Promise((resolve) => setTimeout(resolve, 0));
  await nextTick();
}

describe("useAuthInit studentId resolution", () => {
  let scope: ReturnType<typeof effectScope>;

  beforeEach(() => {
    setActivePinia(createPinia());
    scope = effectScope();
  });

  afterEach(() => {
    scope.stop();
    _setSdkForTesting(null);
  });

  it("resolves studentId once auth is both authenticated and live-checked", async () => {
    makeSdkWith(() => "000123456");
    const auth = useAuthStore();

    // Authenticated but not yet live-checked: no SDK call.
    auth.setStatus("authenticated", Date.now());
    scope.run(() => useAuthInit());
    await flushAsync();
    expect(auth.studentId).toBeNull();

    auth.markLiveChecked();
    await flushAsync();
    expect(auth.studentId).toBe("000123456");
  });

  it("clears studentId when the session drops", async () => {
    makeSdkWith(() => "000123456");
    const auth = useAuthStore();
    auth.setStatus("authenticated", Date.now());
    auth.markLiveChecked();
    scope.run(() => useAuthInit());
    await flushAsync();
    expect(auth.studentId).toBe("000123456");

    auth.setStatus("unauthenticated", null);
    await flushAsync();
    expect(auth.studentId).toBeNull();
  });

  it("leaves studentId null when validation says logged out", async () => {
    makeSdkWith(() => null);
    const auth = useAuthStore();
    auth.setStatus("authenticated", Date.now());
    auth.markLiveChecked();
    scope.run(() => useAuthInit());
    await flushAsync();
    expect(auth.studentId).toBeNull();
    expect(auth.validating).toBe(false);
  });
});
