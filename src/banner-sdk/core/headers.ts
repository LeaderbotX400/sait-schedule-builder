export interface BannerHeaderOpts {
  contentType?: string;
  extra?: Record<string, string>;
}

export function bannerHeaders(opts: BannerHeaderOpts = {}): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/json, text/javascript, */*; q=0.01",
    "Cache-Control": "no-cache",
    Pragma: "no-cache",
    "X-Requested-With": "XMLHttpRequest",
    ...opts.extra,
  };
  if (opts.contentType) headers["Content-Type"] = opts.contentType;
  return headers;
}
