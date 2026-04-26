import type { BannerResponse } from "./types";

const API_BASE = "/api/banner";
const BANNER_ORIGIN =
  "https://sait-sust-prd-prd1-ban-ss-ssag6.sait.ca";
const REFERER_REGISTRATION =
  `${BANNER_ORIGIN}/StudentRegistrationSsb/ssb/classRegistration/classRegistration`;
const REFERER_TERM =
  `${BANNER_ORIGIN}/StudentRegistrationSsb/ssb/term/termSelection?mode=registration`;

export interface BannerCredentials {
  cookies: Record<string, string>;
  synchronizerToken: string;
  uniqueSessionId: string;
}

/**
 * Parse raw HTTP request headers (copied from browser DevTools Network tab)
 * and extract session cookies + synchronizer token.
 */
export function parseRequestHeaders(raw: string): BannerCredentials {
  const lines = raw.split("\n").map((l) => l.trim());

  const cookies: Record<string, string> = {};
  let synchronizerToken = "";
  let uniqueSessionId = "";

  // Try to extract uniqueSessionId from URL in the headers
  const sessionIdMatch = raw.match(/uniqueSessionId=([^&\s]+)/);
  if (sessionIdMatch) {
    uniqueSessionId = sessionIdMatch[1].trim();
  }

  for (const line of lines) {
    const lower = line.toLowerCase();

    if (lower.startsWith("cookie:")) {
      const cookieStr = line.slice("cookie:".length).trim();
      for (const part of cookieStr.split(";")) {
        const eqIdx = part.indexOf("=");
        if (eqIdx > 0) {
          const name = part.slice(0, eqIdx).trim();
          const value = part.slice(eqIdx + 1).trim();
          cookies[name] = value;
        }
      }
    } else if (lower.startsWith("x-synchronizer-token:")) {
      synchronizerToken = line.slice("x-synchronizer-token:".length).trim();
    }
  }

  if (Object.keys(cookies).length === 0) {
    throw new Error("No cookies found in pasted headers");
  }

  // Generate a uniqueSessionId if not found in headers
  if (!uniqueSessionId) {
    uniqueSessionId = `sched${Date.now()}`;
  }

  return { cookies, synchronizerToken, uniqueSessionId };
}

function cookieString(cookies: Record<string, string>): string {
  return Object.entries(cookies)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}

/**
 * Build headers for Banner API requests.
 *
 * Browser Fetch silently strips "Cookie" (forbidden header), so we send
 * credentials via custom X-Banner-* headers. The Vite proxy rewrites
 * them into real Cookie / X-Synchronizer-Token / Referer headers.
 */
function bannerHeaders(
  creds: BannerCredentials,
  referer: string = REFERER_REGISTRATION,
): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/json, text/javascript, */*; q=0.01",
    "Cache-Control": "no-cache",
    Pragma: "no-cache",
    "X-Requested-With": "XMLHttpRequest",
    // Custom headers — rewritten by the Vite proxy
    "X-Banner-Cookies": cookieString(creds.cookies),
    "X-Banner-Referer": referer,
  };

  if (creds.synchronizerToken) {
    headers["X-Banner-Sync-Token"] = creds.synchronizerToken;
  }

  return headers;
}

// ---- Credential validation ----

/**
 * Validate credentials by making a test API request.
 * Returns true if valid, false if invalid.
 */
export async function validateCredentials(
  creds: BannerCredentials,
): Promise<{ valid: boolean; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/ssb/userPreference/fetchUsageTracking`, {
      headers: bannerHeaders(creds),
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    if (!res.ok) {
      return {
        valid: false,
        error: `Banner returned ${res.status}. Check that your credentials are current and haven't expired.`,
      };
    }

    return { valid: true };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unknown error during validation";
    return {
      valid: false,
      error:
        message.includes("timeout") || message.includes("TimeoutError")
          ? "Request timed out. Check your internet connection and try again."
          : `Validation failed: ${message}`,
    };
  }
}

// ---- Session initialization ----

/** Step 0 & 3: Fetch usage tracking (required to initialize/finalize session) */
async function fetchUsageTracking(creds: BannerCredentials): Promise<void> {
  await fetch(`${API_BASE}/ssb/userPreference/fetchUsageTracking`, {
    headers: bannerHeaders(creds),
  });
  // Best-effort — don't throw on failure
}

/** Step 1: Save the selected term to the Banner session (GET) */
async function saveTermStep(
  creds: BannerCredentials,
  term: string,
): Promise<void> {
  const params = new URLSearchParams({
    mode: "registration",
    term,
    uniqueSessionId: creds.uniqueSessionId,
  });

  const res = await fetch(`${API_BASE}/ssb/term/saveTerm?${params}`, {
    headers: bannerHeaders(creds, REFERER_TERM),
  });

  if (!res.ok) {
    throw new Error(`Failed to save term: ${res.status}`);
  }
}

/** Step 2: POST term search to confirm term selection */
async function confirmTermStep(
  creds: BannerCredentials,
  term: string,
): Promise<void> {
  const body = new URLSearchParams({
    term,
    studyPath: "",
    studyPathText: "",
    startDatepicker: "",
    endDatepicker: "",
    uniqueSessionId: creds.uniqueSessionId,
  });

  const headers = bannerHeaders(creds, REFERER_TERM);
  headers["Content-Type"] = "application/x-www-form-urlencoded; charset=UTF-8";
  headers["X-Banner-Origin"] = BANNER_ORIGIN;

  await fetch(`${API_BASE}/ssb/term/search?mode=registration`, {
    method: "POST",
    headers,
    body: body.toString(),
  });
  // Best-effort
}

/**
 * Full term initialization sequence — must run before any course search.
 *
 * 0. fetchUsageTracking
 * 1. saveTerm (GET)
 * 2. term/search (POST)
 * 3. fetchUsageTracking again
 */
export async function initializeTermSession(
  creds: BannerCredentials,
  term: string,
): Promise<void> {
  await fetchUsageTracking(creds);
  await saveTermStep(creds, term);
  await confirmTermStep(creds, term);
  await fetchUsageTracking(creds);
}

// ---- Course search ----

export interface SearchResult {
  response: BannerResponse;
  /** Per-code breakdown: which codes returned data and which didn't */
  perCode: { code: string; count: number; error?: string }[];
}

/**
 * Search for course sections by subject+course combo (e.g. "CPRG307").
 *
 * Banner's searchResults endpoint is session-stateful — after one search
 * the context changes and subsequent searches return nothing. So we
 * re-initialize the term session before EACH course code search.
 */
export async function searchCourses(
  creds: BannerCredentials,
  term: string,
  courseCodes: string[],
): Promise<SearchResult> {
  const allData: BannerResponse["data"] = [];
  const perCode: SearchResult["perCode"] = [];

  for (const code of courseCodes) {
    try {
      // Re-initialize term session for each search
      await initializeTermSession(creds, term);

      const params = new URLSearchParams({
        txt_subjectcoursecombo: code,
        txt_term: term,
        startDatepicker: "",
        endDatepicker: "",
        uniqueSessionId: creds.uniqueSessionId,
        pageOffset: "0",
        pageMaxSize: "500",
        sortColumn: "subjectDescription",
        sortDirection: "asc",
      });

      const res = await fetch(
        `${API_BASE}/ssb/searchResults/searchResults?${params}`,
        { headers: bannerHeaders(creds) },
      );

      if (!res.ok) {
        perCode.push({ code, count: 0, error: `HTTP ${res.status}` });
        continue;
      }

      const json = (await res.json()) as BannerResponse;
      const count = json.data?.length ?? 0;
      if (json.data && count > 0) {
        allData.push(...json.data);
      }
      perCode.push({ code, count });
    } catch (e) {
      perCode.push({
        code,
        count: 0,
        error: e instanceof Error ? e.message : "Unknown error",
      });
    }
  }

  return {
    response: {
      success: true,
      totalCount: allData.length,
      data: allData,
    },
    perCode,
  };
}

/** Fetch available terms from Banner */
export async function getTerms(
  creds: BannerCredentials,
): Promise<{ code: string; description: string }[]> {
  const params = new URLSearchParams({
    searchTerm: "",
    offset: "1",
    max: "20",
  });

  const res = await fetch(
    `${API_BASE}/ssb/classSearch/getTerms?${params}`,
    { headers: bannerHeaders(creds) },
  );

  if (!res.ok) {
    throw new Error(`Failed to fetch terms: ${res.status}`);
  }

  return res.json();
}

/** Look up subject codes via autocomplete */
export async function searchSubjects(
  creds: BannerCredentials,
  term: string,
  searchTerm: string,
): Promise<{ code: string; description: string }[]> {
  const params = new URLSearchParams({
    searchTerm,
    term,
    offset: "1",
    max: "50",
  });

  const res = await fetch(
    `${API_BASE}/ssb/classSearch/get_subjectcoursecombo?${params}`,
    { headers: bannerHeaders(creds) },
  );

  if (!res.ok) return [];
  return res.json();
}
