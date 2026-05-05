import { describe, expect, it } from "vitest";
import { DEFAULT_HOSTS } from "../config/hosts";
import { bannerRequest } from "../core/request";
import {
  BannerAuthRequiredError,
  BannerHttpError,
  BannerNotPermittedError,
  BannerSessionExpiredError,
} from "../transport/errors";
import { MockTransport } from "../transport/mock";

function makeCtx() {
  return { transport: new MockTransport(), hosts: DEFAULT_HOSTS };
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

  it("throws BannerAuthRequiredError when extension can't reach Banner (status 0)", async () => {
    const ctx = makeCtx();
    ctx.transport.on("/foo", {
      ok: false,
      status: 0,
      contentType: "",
      body: "",
      error: "fetch failed",
    });
    await expect(bannerRequest(ctx, "https://x/foo")).rejects.toThrow(BannerAuthRequiredError);
  });

  it("throws BannerSessionExpiredError when response is HTML on a JSON endpoint", async () => {
    const ctx = makeCtx();
    ctx.transport.on("/foo", {
      ok: true,
      status: 200,
      contentType: "text/html",
      body: "<html></html>",
    });
    await expect(bannerRequest(ctx, "https://x/foo")).rejects.toThrow(BannerSessionExpiredError);
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
    await expect(bannerRequest(ctx, "https://x/foo")).rejects.toThrow(BannerHttpError);
    expect(callCount).toBe(1);
  });
});
