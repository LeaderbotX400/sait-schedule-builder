import type { BannerResponse } from "./types";

const API_BASE = "/api/banner";

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
 * "Cookie" is a forbidden header in the browser Fetch API — the browser
 * silently strips it. So we send credentials via custom X-Banner-* headers,
 * which the Vite proxy rewrites into real Cookie / X-Synchronizer-Token
 * headers on the outgoing request to Banner.
 */
function bannerHeaders(creds: BannerCredentials): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/json, text/javascript, */*; q=0.01",
    "Cache-Control": "no-cache",
    Pragma: "no-cache",
    "X-Requested-With": "XMLHttpRequest",
    // Custom headers — rewritten by the Vite proxy into real headers
    "X-Banner-Cookies": cookieString(creds.cookies),
  };

  if (creds.synchronizerToken) {
    headers["X-Banner-Sync-Token"] = creds.synchronizerToken;
  }

  return headers;
}

/** Save the selected term to the Banner session */
export async function saveTerm(
  creds: BannerCredentials,
  term: string,
): Promise<void> {
  const params = new URLSearchParams({
    mode: "registration",
    term,
    ...(creds.uniqueSessionId && {
      uniqueSessionId: creds.uniqueSessionId,
    }),
  });

  const res = await fetch(`${API_BASE}/ssb/term/saveTerm?${params}`, {
    headers: bannerHeaders(creds),
  });

  if (!res.ok) {
    throw new Error(`Failed to save term: ${res.status}`);
  }
}

/** Search for course sections by subject+course combo (e.g. "CPRG307") */
export async function searchCourses(
  creds: BannerCredentials,
  term: string,
  courseCodes: string[],
): Promise<BannerResponse> {
  // First save the term
  await saveTerm(creds, term);

  // Search for each course code and merge results
  const allData: BannerResponse["data"] = [];

  for (const code of courseCodes) {
    const params = new URLSearchParams({
      txt_subjectcoursecombo: code,
      txt_term: term,
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
      throw new Error(`Search failed for "${code}": ${res.status}`);
    }

    const json = (await res.json()) as BannerResponse;
    if (json.data) {
      allData.push(...json.data);
    }
  }

  return {
    success: true,
    totalCount: allData.length,
    data: allData,
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
