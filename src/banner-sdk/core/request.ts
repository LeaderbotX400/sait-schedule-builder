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

interface RequestContext {
  transport: BannerTransport;
  hosts: BannerHostConfig;
}

export async function bannerRequest<T>(
  ctx: RequestContext,
  url: string,
  init: BannerRequestInit = {},
): Promise<T> {
  const headers = bannerHeaders({
    ...(init.body ? { contentType: "application/x-www-form-urlencoded; charset=UTF-8" } : {}),
    extra: init.headers ?? {},
  });

  const callInit: BannerRequestInit = { method: init.method ?? "GET", headers };
  if (init.body !== undefined) callInit.body = init.body;

  const start = performance.now();
  const tag = `${callInit.method} ${shortPath(url)}`;
  try {
    const raw = await ctx.transport.fetch(url, callInit);

    if (raw.status === 403 && looksLikeAccessDenied(raw)) {
      throw new BannerNotPermittedError(url, raw);
    }
    const result = finalize<T>(raw);
    log.debug(`${tag} → ${raw.status} (${ms(start)}ms)`);
    return result;
  } catch (err) {
    logRequestFailure(tag, ms(start), err);
    throw err;
  }
}

function finalize<T>(raw: RawResponse): T {
  if (raw.error) {
    if (raw.status === 0) {
      throw new BannerAuthRequiredError();
    }
    throw new BannerNetworkError(raw.error);
  }
  if (!raw.ok) throw new BannerHttpError(raw.status, raw.body);
  if (raw.contentType.includes("text/html")) throw new BannerSessionExpiredError();
  return parseJsonOrThrow<T>(raw);
}

export async function bannerRequestRaw(
  ctx: RequestContext,
  url: string,
  init: BannerRequestInit = {},
): Promise<RawResponse> {
  const headers = bannerHeaders({
    ...(init.body ? { contentType: "application/x-www-form-urlencoded; charset=UTF-8" } : {}),
    extra: init.headers ?? {},
  });

  const callInit: BannerRequestInit = { method: init.method ?? "GET", headers };
  if (init.body !== undefined) callInit.body = init.body;

  const start = performance.now();
  const tag = `${callInit.method} ${shortPath(url)} (raw)`;
  try {
    const raw = await ctx.transport.fetch(url, callInit);

    if (raw.status === 403 && looksLikeAccessDenied(raw)) {
      throw new BannerNotPermittedError(url, raw);
    }
    if (raw.error) throw new BannerNetworkError(raw.error);
    log.debug(`${tag} → ${raw.status} (${ms(start)}ms)`);
    return raw;
  } catch (err) {
    logRequestFailure(tag, ms(start), err);
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
