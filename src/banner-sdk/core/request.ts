import type { BannerHostConfig } from "../config/hosts";
import {
    BannerAuthRequiredError,
    BannerHttpError,
    BannerNetworkError,
    BannerNotPermittedError,
    BannerSessionExpiredError,
    looksLikeAccessDenied,
} from "../transport/errors";
import type {
    BannerRequestInit,
    BannerTransport,
    RawResponse,
} from "../transport/types";
import { bannerHeaders } from "./headers";
import { parseJsonOrThrow } from "./json";
import type { SyncTokenCache } from "./syncToken";

interface RequestContext {
  transport: BannerTransport;
  hosts: BannerHostConfig;
  tokens: SyncTokenCache;
}

/**
 * Single chokepoint for every Banner SDK request.
 *
 * Branches on the verified ssag6 status taxonomy (see plan §3 / §6):
 *
 *   - 403 + 30-byte JSON access-denied  →  BannerNotPermittedError (no retry helps)
 *   - 200 + text/html (= SAML AuthnRequest landed on us, JSESSIONID
 *     dead) → refresh sync token via SyncTokenCache (which itself throws
 *     BannerSessionExpiredError if the registration page also returns HTML),
 *     then retry once.
 *   - non-2xx                          →  BannerHttpError
 *   - text/html on a JSON endpoint     →  BannerSessionExpiredError
 *   - network failure                  →  BannerNetworkError
 *
 * On success the body is JSON-parsed and returned typed.
 */
export async function bannerRequest<T>(
  ctx: RequestContext,
  url: string,
  init: BannerRequestInit = {},
): Promise<T> {
  const headers = bannerHeaders({
    syncToken: ctx.tokens.get(),
    ...(init.body
      ? { contentType: "application/x-www-form-urlencoded; charset=UTF-8" }
      : {}),
    extra: init.headers ?? {},
  });

  const callInit: BannerRequestInit = { method: init.method ?? "GET", headers };
  if (init.body !== undefined) callInit.body = init.body;

  let raw = await ctx.transport.fetch(url, callInit);

  if (raw.status === 403 && looksLikeAccessDenied(raw)) {
    throw new BannerNotPermittedError(url, raw);
  }

  // 200 + HTML on what should be a JSON endpoint = SAML redirect chain landed.
  // Refresh token and retry once. If refresh itself throws, propagate.
  if (raw.ok && raw.contentType.includes("text/html")) {
    await ctx.tokens.refresh(ctx.transport, ctx.hosts);
    const retryHeaders = {
      ...headers,
      "X-Synchronizer-Token": ctx.tokens.get() ?? "",
    };
    const retryInit: BannerRequestInit = {
      method: init.method ?? "GET",
      headers: retryHeaders,
    };
    if (init.body !== undefined) retryInit.body = init.body;
    raw = await ctx.transport.fetch(url, retryInit);
  }

  return finalize<T>(raw);
}

function finalize<T>(raw: RawResponse): T {
  if (raw.error) {
    // Status 0 with an error typically means the extension couldn't reach Banner
    // or fetch failed — usually due to missing/invalid credentials.
    if (raw.status === 0) {
      throw new BannerAuthRequiredError();
    }
    throw new BannerNetworkError(raw.error);
  }
  if (!raw.ok) throw new BannerHttpError(raw.status, raw.body);
  if (raw.contentType.includes("text/html"))
    throw new BannerSessionExpiredError();
  return parseJsonOrThrow<T>(raw);
}

/**
 * Same retry semantics as `bannerRequest` but returns the raw body rather
 * than parsing as JSON. Used for endpoints that legitimately return HTML
 * (e.g. /ssb/registration to refresh the sync token, or registration
 * history list pages).
 */
export async function bannerRequestRaw(
  ctx: RequestContext,
  url: string,
  init: BannerRequestInit = {},
): Promise<RawResponse> {
  const headers = bannerHeaders({
    syncToken: ctx.tokens.get(),
    ...(init.body
      ? { contentType: "application/x-www-form-urlencoded; charset=UTF-8" }
      : {}),
    extra: init.headers ?? {},
  });

  const callInit: BannerRequestInit = { method: init.method ?? "GET", headers };
  if (init.body !== undefined) callInit.body = init.body;

  const raw = await ctx.transport.fetch(url, callInit);

  if (raw.status === 403 && looksLikeAccessDenied(raw)) {
    throw new BannerNotPermittedError(url, raw);
  }
  if (raw.error) throw new BannerNetworkError(raw.error);
  return raw;
}
