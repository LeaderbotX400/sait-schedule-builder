import type { BannerRequestInit, BannerTransport, RawResponse } from "./types";

/**
 * Issues Banner requests directly via window.fetch. Only works in contexts
 * that have ambient cookie access to the Banner hosts — i.e. the extension's
 * own page (where host_permissions cover all three Banner origins). On a
 * regular webapp page (localhost / pages.dev) the cookies are not in scope
 * and the requests fail with CORS, so use ExtensionTransport there.
 */
export class DirectTransport implements BannerTransport {
  async fetch(url: string, init?: BannerRequestInit): Promise<RawResponse> {
    try {
      const fetchInit: RequestInit = {
        method: init?.method ?? "GET",
        credentials: "include",
      };
      if (init?.headers) fetchInit.headers = init.headers;
      if (init?.body !== undefined) fetchInit.body = init.body;
      const res = await window.fetch(url, fetchInit);
      return {
        ok: res.ok,
        status: res.status,
        contentType: res.headers.get("content-type") ?? "",
        body: await res.text(),
        redirected: res.redirected,
      };
    } catch (e) {
      return {
        ok: false,
        status: 0,
        contentType: "",
        body: "",
        error: e instanceof Error ? e.message : "Network error",
      };
    }
  }
}
