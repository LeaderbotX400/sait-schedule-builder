/**
 * Build the standard set of headers Banner expects on every XHR call.
 *
 * Banner accepts unauthenticated XHRs as long as JSESSIONID is alive, but
 * it also issues a per-page synchronizer token (CSRF) it expects mutating
 * requests to echo back. Today's app doesn't send it; the SDK does.
 */
export interface BannerHeaderOpts {
  syncToken?: string | null;
  /** Override or add to the default Content-Type. */
  contentType?: string;
  extra?: Record<string, string>;
}

export function bannerHeaders(opts: BannerHeaderOpts = {}): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/json, text/javascript, */*; q=0.01",
    "Cache-Control": "no-cache",
    Pragma: "no-cache",
    "X-Requested-With": "XMLHttpRequest",
    ...(opts.extra ?? {}),
  };
  if (opts.syncToken) headers["X-Synchronizer-Token"] = opts.syncToken;
  if (opts.contentType) headers["Content-Type"] = opts.contentType;
  return headers;
}
