import type { BannerRequestInit, BannerTransport, RawResponse } from "./types";

export interface RecordedCall {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string | undefined;
}

type ResponseProvider = RawResponse | ((call: RecordedCall) => RawResponse | Promise<RawResponse>);

interface Handler {
  matcher: string | RegExp;
  response: ResponseProvider;
}

/**
 * Test transport that records every call and returns canned responses
 * matched by URL substring or regex.
 *
 * Usage:
 *   const t = new MockTransport()
 *     .on("/ssb/classSearch/getTerms", { ok: true, status: 200, contentType: "application/json", body: "[]" });
 *   const sdk = createBannerSdk(t);
 *   await sdk.registration.terms.list();
 *   expect(t.calls[0].url).toContain("/getTerms");
 */
export class MockTransport implements BannerTransport {
  readonly calls: RecordedCall[] = [];
  private readonly handlers: Handler[] = [];

  on(matcher: string | RegExp, response: ResponseProvider): this {
    this.handlers.push({ matcher, response });
    return this;
  }

  reset(): void {
    this.calls.length = 0;
    this.handlers.length = 0;
  }

  async fetch(url: string, init?: BannerRequestInit): Promise<RawResponse> {
    const call: RecordedCall = {
      url,
      method: init?.method ?? "GET",
      headers: init?.headers ?? {},
      body: init?.body,
    };
    this.calls.push(call);

    for (const { matcher, response } of this.handlers) {
      const matches = typeof matcher === "string" ? url.includes(matcher) : matcher.test(url);
      if (matches) {
        return typeof response === "function" ? response(call) : response;
      }
    }

    // Unmatched: return a 404 by default — surfaces missing test wiring loudly.
    return {
      ok: false,
      status: 404,
      contentType: "text/html",
      body: "<html>not found</html>",
    };
  }
}
