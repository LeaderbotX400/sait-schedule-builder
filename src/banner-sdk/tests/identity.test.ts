import { describe, expect, it } from "vitest";
import { validateLogin } from "../apps/general/identity";
import { DEFAULT_HOSTS } from "../config/hosts";
import { BannerSessionExpiredError } from "../transport/errors";
import type { BannerTransport } from "../transport/types";

function throwingTransport(error: unknown): BannerTransport {
  return {
    fetch: async () => {
      throw error;
    },
  };
}

describe("validateLogin", () => {
  it("classifies a thrown BannerSessionExpiredError as NOT_LOGGED_IN", async () => {
    const transport = throwingTransport(new BannerSessionExpiredError());
    const result = await validateLogin(transport, DEFAULT_HOSTS);
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.reason).toBe("NOT_LOGGED_IN");
  });

  it("still classifies generic thrown errors as NETWORK", async () => {
    const transport = throwingTransport(new Error("boom"));
    const result = await validateLogin(transport, DEFAULT_HOSTS);
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.reason).toBe("NETWORK");
  });
});
