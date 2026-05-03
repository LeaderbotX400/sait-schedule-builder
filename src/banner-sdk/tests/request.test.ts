import { describe, expect, it } from "vitest";
import { DEFAULT_HOSTS } from "../config/hosts";
import { bannerRequest } from "../core/request";
import { SyncTokenCache } from "../core/syncToken";
import {
  BannerHttpError,
  BannerNetworkError,
  BannerNotPermittedError,
  BannerSessionExpiredError,
} from "../transport/errors";
import { MockTransport } from "../transport/mock";

function makeCtx() {
  const tokens = new SyncTokenCache();
  tokens.set("sync-1");
  return { transport: new MockTransport(), hosts: DEFAULT_HOSTS, tokens };
}

describe("bannerRequest", () => {
  it("parses JSON on success", async () => {
    const ctx = makeCtx();
    ctx.transport.on("/foo", {
      ok: true,
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ hello: "world" }),
    });
    const result = await bannerRequest<{ hello: string }>(ctx, "https://x/foo");
    expect(result).toEqual({ hello: "world" });
  });

  it("attaches X-Synchronizer-Token from the cache", async () => {
    const ctx = makeCtx();
    ctx.transport.on("/foo", {
      ok: true,
      status: 200,
      contentType: "application/json",
      body: "{}",
    });
    await bannerRequest(ctx, "https://x/foo");
    expect(ctx.transport.calls[0]?.headers["X-Synchronizer-Token"]).toBe("sync-1");
  });

  it("throws BannerNotPermittedError for SAML-gated 403", async () => {
    const ctx = makeCtx();
    ctx.transport.on("/foo", {
      ok: false,
      status: 403,
      contentType: "application/json",
      body: '{"error":"access denied"}',
    });
    await expect(bannerRequest(ctx, "https://x/foo")).rejects.toThrow(BannerNotPermittedError);
  });

  it("throws BannerHttpError for plain non-2xx", async () => {
    const ctx = makeCtx();
    ctx.transport.on("/foo", {
      ok: false,
      status: 500,
      contentType: "application/json",
      body: "{}",
    });
    await expect(bannerRequest(ctx, "https://x/foo")).rejects.toThrow(BannerHttpError);
  });

  it("throws BannerNetworkError for transport-level failures", async () => {
    const ctx = makeCtx();
    ctx.transport.on("/foo", {
      ok: false,
      status: 0,
      contentType: "",
      body: "",
      error: "fetch failed",
    });
    await expect(bannerRequest(ctx, "https://x/foo")).rejects.toThrow(BannerNetworkError);
  });

  it("refreshes sync token and retries when the response is HTML (200)", async () => {
    const ctx = makeCtx();
    let callCount = 0;
    ctx.transport.on(/.*/, () => {
      callCount++;
      if (callCount === 1) {
        // First /foo call returns HTML — token cycle landed on us.
        return { ok: true, status: 200, contentType: "text/html", body: "<html></html>" };
      }
      if (callCount === 2) {
        // Refresh fetch — registration page returns the meta tag.
        return {
          ok: true,
          status: 200,
          contentType: "text/html",
          body: '<meta name="synchronizerToken" content="sync-2">',
        };
      }
      // Retry of /foo — now succeeds.
      return { ok: true, status: 200, contentType: "application/json", body: '{"ok":true}' };
    });
    const result = await bannerRequest<{ ok: boolean }>(ctx, "https://x/foo");
    expect(result).toEqual({ ok: true });
    expect(ctx.tokens.get()).toBe("sync-2");
    // First call = original /foo, second = registration refresh, third = retry of /foo.
    expect(callCount).toBe(3);
  });

  it("throws BannerSessionExpiredError if the refresh itself returns HTML without the meta tag", async () => {
    const ctx = makeCtx();
    let callCount = 0;
    ctx.transport.on(/.*/, () => {
      callCount++;
      // /foo: HTML; refresh: HTML without meta — so cache.refresh throws.
      return {
        ok: true,
        status: 200,
        contentType: "text/html",
        body: "<html><body>plain</body></html>",
      };
    });
    await expect(bannerRequest(ctx, "https://x/foo")).rejects.toThrow(BannerSessionExpiredError);
    expect(callCount).toBe(2);
  });

  it("sends form-urlencoded content-type when body is set", async () => {
    const ctx = makeCtx();
    ctx.transport.on("/foo", {
      ok: true,
      status: 200,
      contentType: "application/json",
      body: "{}",
    });
    await bannerRequest(ctx, "https://x/foo", { method: "POST", body: "term=202540" });
    expect(ctx.transport.calls[0]?.headers["Content-Type"]).toContain(
      "application/x-www-form-urlencoded",
    );
  });

  it("does not retry permitted endpoints when 403 isn't access-denied", async () => {
    const ctx = makeCtx();
    let callCount = 0;
    ctx.transport.on("/foo", () => {
      callCount++;
      return { ok: false, status: 403, contentType: "text/html", body: "<html>nope</html>" };
    });
    // 403 + HTML doesn't trigger looksLikeAccessDenied — falls through to BannerHttpError.
    await expect(bannerRequest(ctx, "https://x/foo")).rejects.toThrow(BannerHttpError);
    expect(callCount).toBe(1);
  });
});
