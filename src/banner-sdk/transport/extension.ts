import { bannerFetch, bannerPrime } from "../../lib/extension";
import { BannerSessionExpiredError } from "./errors";
import type { BannerRequestInit, BannerTransport, RawResponse } from "./types";

/**
 * Routes every Banner request through the chrome extension's BANNER_FETCH
 * service-worker handler. The extension carries the user's Banner cookies
 * (host_permissions on all three Banner subdomains) so the request hits
 * Banner already authenticated.
 *
 * This is the default transport when the schedule-builder is loaded as a
 * web page (localhost / pages.dev). When loaded as the extension's own
 * page, DirectTransport is also viable.
 */
export class ExtensionTransport implements BannerTransport {
  async fetch(url: string, init?: BannerRequestInit): Promise<RawResponse> {
    const raw = await bannerFetch(url, init);
    // The extension service worker uses redirect:"manual" to avoid CORS errors on
    // cross-origin redirects (e.g., b2clogin.com). Session expiry is detected via
    // HTML responses on JSON endpoints (in core/request.ts finalize). The legacy
    // BANNER_SESSION_EXPIRED error code is kept as a safety fallback.
    if (raw.error === "BANNER_SESSION_EXPIRED") {
      throw new BannerSessionExpiredError("Banner session expired (redirected to login).");
    }
    return raw;
  }

  async prime(url: string): Promise<void> {
    // Best-effort: if priming fails, the subsequent real fetch will surface
    // the actual error. No need to throw or log here.
    await bannerPrime(url);
  }
}
