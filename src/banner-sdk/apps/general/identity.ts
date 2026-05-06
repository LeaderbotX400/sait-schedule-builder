import { type BannerHostConfig, ssag2Url } from "../../config/hosts";
import { bannerHeaders } from "../../core/headers";
import { parseJsonOrThrow } from "../../core/json";
import {
  BannerAuthRequiredError,
  BannerNetworkError,
  BannerNotPermittedError,
  BannerSessionExpiredError,
  looksLikeAccessDenied,
} from "../../transport/errors";
import type { BannerTransport } from "../../transport/types";
import type { BannerIdResponse } from "./types";

export type LoginValidation =
  | { valid: true; studentId: string }
  | { valid: false; reason: "NETWORK" | "NOT_LOGGED_IN" | "MALFORMED"; error: string };

/**
 * Single source of truth for "is the user logged in?" + the chokepoint
 * that yields `studentId` (every selfService endpoint needs it).
 *
 * Hits getBannerId on ssag2. Any of: network failure, non-2xx, redirect
 * to login (HTML response), empty body, missing/falsy bannerId — counts
 * as logged out. ssag2 only returns 404/200 so the access-denied JSON
 * heuristic doesn't apply here, but we still guard against the ssag6
 * edge case for future-proofing.
 */
export async function validateLogin(
  transport: BannerTransport,
  hosts: BannerHostConfig,
): Promise<LoginValidation> {
  const temp = await fetch("https://sait-sust-prd-prd1-eid-idm-wso2.sait.ca/cas-web/login?TARGET=https%3A%2F%2Fsait-sust-prd-prd1-ban-ss-ssag1.sait.ca%2FStudentSelfService%2Flogin%2Fcas", {
    method: "GET",
    credentials: "include",
  });

  console.log("CAS login page response:", temp);
  const url = ssag2Url(hosts, "/ssb/PersonalInformationDetails/getBannerId");
  let raw: Awaited<ReturnType<BannerTransport["fetch"]>>;
  try {
    raw = await transport.fetch(url, { headers: bannerHeaders() });
  } catch (e) {
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
    return {
      valid: false,
      reason: "NETWORK",
      error: e instanceof BannerNetworkError ? e.message : `Could not reach Banner: ${String(e)}`,
    };
  }

  if (raw.status === 403 && looksLikeAccessDenied(raw)) {
    throw new BannerNotPermittedError(url, raw);
  }
  if (raw.error) {
    return { valid: false, reason: "NETWORK", error: `Could not reach Banner: ${raw.error}` };
  }
  if (!raw.ok) {
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
