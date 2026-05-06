/**
 * Transport-layer types — the seam between the SDK and whatever ships HTTP
 * to Banner (extension service worker, direct fetch, mock).
 */

export interface RawResponse {
  ok: boolean;
  status: number;
  contentType: string;
  /** Response body as text. JSON parsing happens upstream. */
  body: string;
  /** True if the underlying fetch followed a redirect. Optional — extension transport doesn't surface this today. */
  redirected?: boolean;
  /** Network-layer error. When set, ok=false and status=0. */
  error?: string;
}

export interface BannerRequestInit {
  method?: "GET" | "POST";
  headers?: Record<string, string>;
  body?: string;
}

export interface BannerTransport {
  fetch(url: string, init?: BannerRequestInit): Promise<RawResponse>;
  /**
   * Optional host-priming hook. Triggers a credentialed, follow-redirect GET
   * against a host root so Banner's CAS/SAML bounce can mint per-host
   * JSESSIONID + NLB cookies. No-op or absent on transports that don't need it
   * (DirectTransport, MockTransport).
   */
  prime?(url: string): Promise<void>;
}
