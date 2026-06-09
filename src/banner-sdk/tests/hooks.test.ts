import { describe, expect, it, vi } from "vitest";
import { DEFAULT_HOSTS } from "../config/hosts";
import { bannerRequest, type BannerSdkHooks } from "../core/request";
import { createBannerSdk } from "../facade";
import { BannerError, BannerSessionExpiredError } from "../transport/errors";
import { MockTransport } from "../transport/mock";

function makeCtx(hooks?: BannerSdkHooks) {
  return { transport: new MockTransport(), hosts: DEFAULT_HOSTS, hooks };
}

describe("hooks.onError", () => {
  it("fires with the classified error and url on failure", async () => {
    const onError = vi.fn();
    const ctx = makeCtx({ onError });
    ctx.transport.on("/foo", {
      ok: true,
      status: 200,
      contentType: "text/html",
      body: "<html></html>",
    });
    await expect(bannerRequest(ctx, "https://x/foo")).rejects.toThrow(BannerSessionExpiredError);
    expect(onError).toHaveBeenCalledTimes(1);
    const [err, url] = onError.mock.calls[0]!;
    expect(err).toBeInstanceOf(BannerSessionExpiredError);
    expect(url).toBe("https://x/foo");
  });

  it("does not fire on success", async () => {
    const onError = vi.fn();
    const ctx = makeCtx({ onError });
    ctx.transport.on("/foo", {
      ok: true,
      status: 200,
      contentType: "application/json",
      body: "{}",
    });
    await bannerRequest(ctx, "https://x/foo");
    expect(onError).not.toHaveBeenCalled();
  });

  it("threads from createBannerSdk options through registration calls", async () => {
    const transport = new MockTransport();
    const errors: BannerError[] = [];
    const sdk = createBannerSdk(transport, { hooks: { onError: (e) => errors.push(e) } });
    transport.on(/getTerms/, {
      ok: true,
      status: 200,
      contentType: "text/html",
      body: "<html>login</html>",
    });
    await expect(sdk.registration.terms.list()).rejects.toThrow(BannerSessionExpiredError);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toBeInstanceOf(BannerSessionExpiredError);
  });
});
