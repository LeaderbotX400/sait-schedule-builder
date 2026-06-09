import { createLogger } from "../../../lib/logger";
import { type BannerHostConfig, ssag2Url } from "../../config/hosts";
import { parseJsonOrThrow } from "../../core/json";
import { bannerRequestRaw } from "../../core/request";
import {
  BannerAuthRequiredError,
  BannerNetworkError,
  BannerNotPermittedError,
  BannerSessionExpiredError,
} from "../../transport/errors";
import type { BannerTransport, RawResponse } from "../../transport/types";
import type { BannerIdResponse } from "./types";

const log = createLogger("identity");

export type LoginValidation =
  | { valid: true; studentId: string }
  | {
      valid: false;
      reason: "NETWORK" | "NOT_LOGGED_IN" | "MALFORMED";
      error: string;
    };

/**
 * Single source of truth for "is the user logged in?" + the chokepoint
 * that yields `studentId` (every selfService endpoint needs it).
 *
 * Hits getBannerId on ssag2. Any of: network failure, non-2xx, redirect
 * to login (HTML response), empty body, missing/falsy bannerId — counts
 * as logged out.
 */
const CAS_WARMUP_URL =
  "https://sait-sust-prd-prd1-eid-idm-wso2.sait.ca/cas-web/login?TARGET=https%3A%2F%2Fsait-sust-prd-prd1-ban-ss-ssag1.sait.ca%2FStudentSelfService%2Flogin%2Fcas";

export async function validateLogin(
  transport: BannerTransport,
  hosts: BannerHostConfig,
): Promise<LoginValidation> {
  // Touch the CAS gateway with the user's existing SSO cookies before hitting
  // ssag2. SAIT's IdP needs a fresh redirect cycle to mint a per-host session.
  // Route through the transport (extension SW) so the call works from any
  // origin — a direct fetch() to sait.ca from localhost is CORS-blocked.
  try {
    await transport.prime?.(CAS_WARMUP_URL);
    log.debug("CAS warmup completed");
  } catch (e) {
    log.warn(`CAS warmup failed (continuing) — ${e instanceof Error ? e.message : String(e)}`);
  }

  const url = ssag2Url(hosts, "/ssb/PersonalInformationDetails/getBannerId");

  // Deliberately hookless context: validateLogin is the auth *probe* — its
  // failures are expected outcomes mapped into LoginValidation, not global
  // session-expiry events. (BannerNotPermittedError still propagates.)
  let raw: RawResponse;
  try {
    raw = await bannerRequestRaw({ transport, hosts }, url);
  } catch (e) {
    return loginFailureFrom(e);
  }

  if (!raw.ok) {
    bestEffortSamlNudge(url);
    return {
      valid: false,
      reason: "NOT_LOGGED_IN",
      error: `Banner returned ${raw.status}. Sign in and refresh your credentials.`,
    };
  }
  if (
    !raw.contentType.includes("application/json") &&
    !raw.contentType.includes("text/javascript")
  ) {
    return {
      valid: false,
      reason: "NOT_LOGGED_IN",
      error: "Session has expired — Banner redirected to login. Please refresh your credentials.",
    };
  }

  let body: BannerIdResponse;
  try {
    body = parseJsonOrThrow<BannerIdResponse>(raw);
  } catch {
    return {
      valid: false,
      reason: "MALFORMED",
      error: "Banner returned an unexpected payload for getBannerId.",
    };
  }
  const bannerId = body?.bannerId;
  if (!bannerId) {
    return {
      valid: false,
      reason: "NOT_LOGGED_IN",
      error: "You're not signed in to SAIT Banner. Sign in and refresh your credentials.",
    };
  }
  return { valid: true, studentId: String(bannerId) };
}

/** Map errors raised by the request chokepoint into a logged-out result. */
function loginFailureFrom(e: unknown): LoginValidation {
  if (e instanceof BannerSessionExpiredError) {
    return {
      valid: false,
      reason: "NOT_LOGGED_IN",
      error: "Session has expired — please reconnect.",
    };
  }
  if (e instanceof BannerAuthRequiredError) {
    return {
      valid: false,
      reason: "NETWORK",
      error: "Banner returned 0. Sign in and refresh your credentials.",
    };
  }
  if (e instanceof BannerNotPermittedError) throw e;
  return {
    valid: false,
    reason: "NETWORK",
    error:
      e instanceof BannerNetworkError
        ? `Could not reach Banner: ${e.message}`
        : `Could not reach Banner: ${String(e)}`,
  };
}

/**
 * Best-effort: ping the URL in a background tab to trigger any pending
 * SAML refresh that XHR can't satisfy. Only available from the extension's
 * own page — chrome.tabs is undefined in web/localhost context.
 */
function bestEffortSamlNudge(url: string): void {
  if (typeof chrome !== "undefined" && chrome.tabs?.create) {
    chrome.tabs.create({ url, active: false }, (win) => {
      if (!win) return;
      setTimeout(() => {
        chrome.tabs.remove(win.id!);
      }, 200);
    });
  }
}
