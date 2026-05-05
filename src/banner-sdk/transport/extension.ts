import { bannerFetch } from "../../lib/extension";
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
    // The extension service worker uses `redirect: "manual"` to avoid CORS on
    // cross-origin auth redirects (b2clogin.com). When it sees an opaque
    // redirect it returns this sentinel; surface it as a session-expired
    // error so the UI prompts reauth instead of leaking through as a generic
    // network failure.
    if (raw.error === "BANNER_SESSION_EXPIRED") {
      throw new BannerSessionExpiredError("Banner session expired (redirected to login).");
    }
    return raw;
  }
}
