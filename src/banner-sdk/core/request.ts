import { createLogger } from "../../lib/logger";
import type { BannerHostConfig } from "../config/hosts";
import {
  BannerAuthRequiredError,
  BannerError,
  BannerHttpError,
  BannerNetworkError,
  BannerNotPermittedError,
  BannerSessionExpiredError,
  looksLikeAccessDenied,
} from "../transport/errors";
import type { BannerRequestInit, BannerTransport, RawResponse } from "../transport/types";
import { bannerHeaders } from "./headers";
import { parseJsonOrThrow } from "./json";

const log = createLogger("banner-sdk");

/**
 * Optional observers wired in via `createBannerSdk(transport, { hooks })`.
 * Additive only — wire behavior and method signatures are unchanged.
 */
export interface BannerSdkHooks {
  /**
   * Invoked from the request chokepoint whenever a call fails with a
   * classified BannerError (after logging, before the error propagates).
   * Lets the app react globally — e.g. flip auth state on
   * BannerSessionExpiredError — without wrapping every SDK call.
   */
  onError?(err: BannerError, url: string): void;
}

export interface RequestContext {
  transport: BannerTransport;
  hosts: BannerHostConfig;
  hooks?: BannerSdkHooks;
}

/**
 * The single status-taxonomy ladder for JSON endpoints (verified ssag6
 * behavior). Throws the matching BannerError; returns normally when the
 * response is a parseable-JSON candidate.
 */
export function classifyRawResponse(url: string, raw: RawResponse): void {
  if (raw.status === 403 && looksLikeAccessDenied(raw)) {
    throw new BannerNotPermittedError(url, raw);
  }
  if (raw.error) {
    if (raw.status === 0) throw new BannerAuthRequiredError();
    throw new BannerNetworkError(raw.error);
  }
  if (!raw.ok) throw new BannerHttpError(raw.status, raw.body);
  if (raw.contentType.includes("text/html")) throw new BannerSessionExpiredError();
}

export async function bannerRequest<T>(
  ctx: RequestContext,
  url: string,
  init: BannerRequestInit = {},
): Promise<T> {
  return execute(ctx, url, init, "", (raw) => {
    classifyRawResponse(url, raw);
    return parseJsonOrThrow<T>(raw);
  });
}

/**
 * Like `bannerRequest`, but returns the RawResponse without JSON parsing or
 * the full classification ladder — non-2xx and HTML responses come back
 * as-is for callers that interpret them (selfService priming, curriculum
 * HTML, login probing).
 */
export async function bannerRequestRaw(
  ctx: RequestContext,
  url: string,
  init: BannerRequestInit = {},
): Promise<RawResponse> {
  return execute(ctx, url, init, " (raw)", (raw) => {
    if (raw.status === 403 && looksLikeAccessDenied(raw)) {
      throw new BannerNotPermittedError(url, raw);
    }
    if (raw.error) throw new BannerNetworkError(raw.error);
    return raw;
  });
}

async function execute<T>(
  ctx: RequestContext,
  url: string,
  init: BannerRequestInit,
  tagSuffix: string,
  handle: (raw: RawResponse) => T,
): Promise<T> {
  const headers = bannerHeaders({
    ...(init.body ? { contentType: "application/x-www-form-urlencoded; charset=UTF-8" } : {}),
    extra: init.headers ?? {},
  });

  const callInit: BannerRequestInit = { method: init.method ?? "GET", headers };
  if (init.body !== undefined) callInit.body = init.body;

  const start = performance.now();
  const tag = `${callInit.method} ${shortPath(url)}${tagSuffix}`;
  try {
    const raw = await ctx.transport.fetch(url, callInit);
    const result = handle(raw);
    log.debug(`${tag} → ${raw.status} (${ms(start)}ms)`);
    return result;
  } catch (err) {
    logRequestFailure(tag, ms(start), err);
    if (err instanceof BannerError) ctx.hooks?.onError?.(err, url);
    throw err;
  }
}

function ms(start: number): number {
  return Math.round(performance.now() - start);
}

/** Strip the host + Banner app prefix so logs aren't dominated by URL noise. */
function shortPath(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname + (u.search || "");
  } catch {
    return url;
  }
}

function logRequestFailure(tag: string, elapsedMs: number, err: unknown): void {
  if (err instanceof BannerError) {
    log.warn(`${tag} → ${err.name}: ${err.message} (${elapsedMs}ms)`);
  } else {
    log.error(`${tag} → unexpected error (${elapsedMs}ms)`, err);
  }
}
