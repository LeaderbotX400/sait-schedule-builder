import type { BannerCredentials, BannerResponse } from "./types";

/**
 * Parse raw HTTP request headers (copied from browser DevTools) to extract
 * session cookies and synchronizer token for Banner API access.
 */
export function parseRequestHeaders(raw: string): BannerCredentials {
  const lines = raw.split("\n").map((l) => l.trim());

  let cookies = "";
  let synchronizerToken = "";
  let baseUrl = "https://bannerssb.sait.ca/StudentRegistrationSsb";

  for (const line of lines) {
    const lower = line.toLowerCase();
    if (lower.startsWith("cookie:")) {
      cookies = line.slice("cookie:".length).trim();
    } else if (lower.startsWith("x-synchronizer-token:")) {
      synchronizerToken = line.slice("x-synchronizer-token:".length).trim();
    } else if (lower.startsWith("origin:")) {
      const origin = line.slice("origin:".length).trim();
      if (origin.includes("sait.ca")) {
        baseUrl = origin + "/StudentRegistrationSsb";
      }
    }
  }

  if (!cookies) {
    throw new Error("Could not find Cookie header in pasted headers");
  }

  return { cookies, synchronizerToken, baseUrl };
}

/**
 * Search for courses via the Banner API.
 * Note: This requires CORS to be handled (e.g., via a proxy or browser extension).
 */
export async function searchCourses(
  credentials: BannerCredentials,
  term: string,
  subjects: string[],
): Promise<BannerResponse> {
  // First, save the term to the session
  await fetch(`${credentials.baseUrl}/ssb/term/saveTerm`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: credentials.cookies,
    },
    body: `term=${term}`,
    credentials: "include",
  });

  // Then search for courses
  const params = new URLSearchParams();
  params.set("txt_term", term);
  params.set("pageOffset", "0");
  params.set("pageMaxSize", "500");
  params.set("sortColumn", "subjectDescription");
  params.set("sortDirection", "asc");

  for (const subject of subjects) {
    params.append("txt_subject", subject);
  }

  const response = await fetch(
    `${credentials.baseUrl}/ssb/classSearch/get_subjectcoursecombo?${params.toString()}`,
    {
      headers: {
        Cookie: credentials.cookies,
        "X-Synchronizer-Token": credentials.synchronizerToken,
      },
      credentials: "include",
    },
  );

  if (!response.ok) {
    throw new Error(`Banner API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}
