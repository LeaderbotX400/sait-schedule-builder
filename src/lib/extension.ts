/**
 * Banner-facing convenience wrappers over the typed extension bridge.
 * The message protocol lives in `lib/bridge/protocol.ts`; the context
 * resolution (in-extension vs web + extension ID) in `lib/bridge/client.ts`.
 */

import { sendBridgeMessage } from "./bridge/client";
import type { BannerFetchResult, BannerPrimeResult, BridgeFetchInit } from "./bridge/protocol";

export interface BannerFetchResponse extends BannerFetchResult {
  message?: string;
}

export function bannerFetch(url: string, init?: BridgeFetchInit): Promise<BannerFetchResponse> {
  const message: { type: "BANNER_FETCH"; url: string; init?: BridgeFetchInit } = init
    ? { type: "BANNER_FETCH", url, init }
    : { type: "BANNER_FETCH", url };
  return sendBridgeMessage<"BANNER_FETCH">(message).then(normalizeFetchResult);
}

/**
 * A BridgeErrorEnvelope has no status/contentType/body — normalize it into
 * the RawResponse-compatible shape ExtensionTransport expects (status 0 +
 * error string is the SDK's network/auth-failure signal).
 */
function normalizeFetchResult(
  result: BannerFetchResult | { ok: false; error: string; message: string },
): BannerFetchResponse {
  if ("status" in result) return result;
  return {
    ok: false,
    status: 0,
    contentType: "",
    body: "",
    error: result.error,
    message: result.message,
  };
}

export interface BannerPrimeResponse extends BannerPrimeResult {
  message?: string;
}

/**
 * Asks the SW to issue a credentialed, follow-redirect GET to a host root so
 * Banner's CAS/SAML bounce can mint per-host JSESSIONID + NLB cookies. Used to
 * bootstrap ssag1/ssag2 sessions; ssag6 is primed by the login popup.
 */
export function bannerPrime(url: string): Promise<BannerPrimeResponse> {
  return sendBridgeMessage<"BANNER_PRIME">({ type: "BANNER_PRIME", url });
}
