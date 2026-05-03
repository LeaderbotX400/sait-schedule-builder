import { bannerFetch } from "../../lib/extension";
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
    return bannerFetch(url, init);
  }
}
