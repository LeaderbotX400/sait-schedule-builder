import type { BannerHostConfig } from "../config/hosts";
import {
  BannerAuthRequiredError,
  BannerHttpError,
  BannerNetworkError,
  BannerNotPermittedError,
  BannerSessionExpiredError,
  looksLikeAccessDenied,
} from "../transport/errors";
import type { BannerRequestInit, BannerTransport, RawResponse } from "../transport/types";
import { bannerHeaders } from "./headers";
import { parseJsonOrThrow } from "./json";

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

  const raw = await ctx.transport.fetch(url, callInit);

  if (raw.status === 403 && looksLikeAccessDenied(raw)) {
    throw new BannerNotPermittedError(url, raw);
  }

  return finalize<T>(raw);
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

  const raw = await ctx.transport.fetch(url, callInit);

  if (raw.status === 403 && looksLikeAccessDenied(raw)) {
    throw new BannerNotPermittedError(url, raw);
  }
  if (raw.error) throw new BannerNetworkError(raw.error);
  return raw;
}
