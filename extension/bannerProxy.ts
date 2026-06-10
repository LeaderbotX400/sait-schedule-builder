// Banner fetch/prime proxying — the SW carries the user's Banner cookies
// (host_permissions on the SAIT subdomains) so requests arrive authenticated.

import type {
  BannerFetchResult,
  BannerPrimeResult,
  BridgeRequests,
} from "../src/lib/bridge/protocol";

// URL allowlist — BANNER_FETCH only forwards to SAIT Banner subdomains.
// Without this any page on localhost / pages.dev that knows the extension ID
// could ride the user's session cookies for arbitrary SSRF.
const SAIT_URL_ALLOWLIST = /^https:\/\/[a-z0-9-]+\.sait\.ca\//i;

export async function handleBannerFetch(
  req: BridgeRequests["BANNER_FETCH"],
): Promise<BannerFetchResult> {
  if (!SAIT_URL_ALLOWLIST.test(req.url)) {
    return { ok: false, status: 0, contentType: "", body: "", error: "URL not in allowlist" };
  }
  try {
    const init: RequestInit = {
      method: req.init?.method ?? "GET",
      credentials: "include",
      redirect: "manual",
    };
    if (req.init?.headers) init.headers = req.init.headers;
    if (req.init?.body !== undefined) init.body = req.init.body;
    const res = await fetch(req.url, init);
    if (res.type === "opaqueredirect") {
      return { ok: false, status: 0, contentType: "", body: "" };
    }
    const body = await res.text();
    return {
      ok: res.ok,
      status: res.status,
      contentType: res.headers.get("content-type") ?? "",
      body,
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

/**
 * Credentialed, follow-redirect GET to a host root so Banner's CAS/SAML
 * bounce can mint per-host JSESSIONID + NLB cookies. Used to bootstrap
 * ssag1/ssag2 sessions; ssag6 is primed by the login popup.
 */
export async function handleBannerPrime(
  req: BridgeRequests["BANNER_PRIME"],
): Promise<BannerPrimeResult> {
  if (!SAIT_URL_ALLOWLIST.test(req.url)) {
    return { ok: false, error: "URL not in allowlist" };
  }
  try {
    const res = await fetch(req.url, {
      method: "GET",
      credentials: "include",
      redirect: "follow",
    });
    await res.text().catch(() => "");
    return { ok: res.ok || res.status > 0 };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Prime failed" };
  }
}
