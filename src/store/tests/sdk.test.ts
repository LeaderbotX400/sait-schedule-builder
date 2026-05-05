import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { BannerSdk } from "../../banner-sdk";
import { BannerSessionExpiredError } from "../../banner-sdk";
import { useStore } from "../index";
import { _setSdkForTesting, getSdk } from "../sdk";

/**
 * The Proxy in store/sdk.ts catches BannerSessionExpiredError thrown by any
 * SDK call (top-level or nested) and dispatches setLoggedIn(false) on the
 * store. The error itself still propagates so callers can stop work.
 */

function fakeSdk(opts: { topLevelThrows?: boolean; nestedThrows?: boolean }): BannerSdk {
  return {
    flat: async () => {
      if (opts.topLevelThrows) throw new BannerSessionExpiredError();
      return "ok";
    },
    nested: {
      child: async () => {
        if (opts.nestedThrows) throw new BannerSessionExpiredError();
        return "ok";
      },
    },
  } as unknown as BannerSdk;
}

beforeEach(() => {
  useStore.getState().setLoggedIn(true);
});

afterEach(() => {
  _setSdkForTesting(null);
  useStore.getState().setLoggedIn(false);
});

describe("getSdk session-expired Proxy", () => {
  it("sets isLoggedIn=false and rethrows when a top-level method throws", async () => {
    _setSdkForTesting(fakeSdk({ topLevelThrows: true }));
    const sdk = getSdk() as unknown as { flat: () => Promise<string> };
    await expect(sdk.flat()).rejects.toBeInstanceOf(BannerSessionExpiredError);
    expect(useStore.getState().isLoggedIn).toBe(false);
  });

  it("sets isLoggedIn=false when a nested namespace method throws", async () => {
    _setSdkForTesting(fakeSdk({ nestedThrows: true }));
    const sdk = getSdk() as unknown as { nested: { child: () => Promise<string> } };
    await expect(sdk.nested.child()).rejects.toBeInstanceOf(BannerSessionExpiredError);
    expect(useStore.getState().isLoggedIn).toBe(false);
  });

  it("does not change isLoggedIn on the happy path", async () => {
    _setSdkForTesting(fakeSdk({}));
    const sdk = getSdk() as unknown as {
      flat: () => Promise<string>;
      nested: { child: () => Promise<string> };
    };
    await expect(sdk.flat()).resolves.toBe("ok");
    await expect(sdk.nested.child()).resolves.toBe("ok");
    expect(useStore.getState().isLoggedIn).toBe(true);
  });
});
