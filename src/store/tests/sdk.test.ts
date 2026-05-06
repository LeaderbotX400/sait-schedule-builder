import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { _setSdkForTesting, getSdk, useAuthState } from "../../auth";
import type { BannerSdk } from "../../banner-sdk";
import { BannerSessionExpiredError } from "../../banner-sdk";

/**
 * The Proxy in auth/sdk.ts catches BannerSessionExpiredError thrown by any
 * SDK call (top-level or nested) and flips auth status to "unauthenticated".
 * The error itself still propagates so callers can stop work.
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
  useAuthState.getState().setStatus("authenticated", Date.now());
});

afterEach(() => {
  _setSdkForTesting(null);
  useAuthState.getState().reset();
});

describe("getSdk session-expired Proxy", () => {
  it("flips status to unauthenticated and rethrows when a top-level method throws", async () => {
    _setSdkForTesting(fakeSdk({ topLevelThrows: true }));
    const sdk = getSdk() as unknown as { flat: () => Promise<string> };
    await expect(sdk.flat()).rejects.toBeInstanceOf(BannerSessionExpiredError);
    expect(useAuthState.getState().status).toBe("unauthenticated");
  });

  it("flips status to unauthenticated when a nested namespace method throws", async () => {
    _setSdkForTesting(fakeSdk({ nestedThrows: true }));
    const sdk = getSdk() as unknown as { nested: { child: () => Promise<string> } };
    await expect(sdk.nested.child()).rejects.toBeInstanceOf(BannerSessionExpiredError);
    expect(useAuthState.getState().status).toBe("unauthenticated");
  });

  it("does not change status on the happy path", async () => {
    _setSdkForTesting(fakeSdk({}));
    const sdk = getSdk() as unknown as {
      flat: () => Promise<string>;
      nested: { child: () => Promise<string> };
    };
    await expect(sdk.flat()).resolves.toBe("ok");
    await expect(sdk.nested.child()).resolves.toBe("ok");
    expect(useAuthState.getState().status).toBe("authenticated");
  });
});
