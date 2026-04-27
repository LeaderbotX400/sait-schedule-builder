import type { BannerResponse, ActiveRegistration, RegistrationModel, RegistrationBatchResult, RegistrationItemResult } from "./types";

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
 * Ensure credentials have a non-empty uniqueSessionId. The extension often
 * returns an empty string (the registration landing page URL doesn't carry
 * one), and Banner's term/session bookkeeping relies on a stable identifier
 * across the saveTerm → search sequence — without it, searches return null.
 */
function withSessionId(creds: BannerCredentials): BannerCredentials {
  if (creds.uniqueSessionId) return creds;
  return { ...creds, uniqueSessionId: `sched${Date.now()}` };
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
 * Validate credentials by fetching the term list — an endpoint that requires
 * a real authenticated session. Returns valid only if we get actual JSON back.
 */
export async function validateCredentials(
  creds: BannerCredentials,
): Promise<{ valid: boolean; error?: string }> {
  try {
    const params = new URLSearchParams({ searchTerm: "", offset: "1", max: "5" });
    const res = await fetch(
      `${API_BASE}/ssb/classSearch/getTerms?${params}`,
      { headers: bannerHeaders(creds), signal: AbortSignal.timeout(10000) },
    );

    if (!res.ok) {
      return {
        valid: false,
        error: `Banner returned ${res.status}. Check that your credentials are current and haven't expired.`,
      };
    }

    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json") && !contentType.includes("text/javascript")) {
      return {
        valid: false,
        error: "Session has expired — Banner redirected to login. Please refresh your credentials.",
      };
    }

    const data = await res.json();
    if (!Array.isArray(data)) {
      return {
        valid: false,
        error: "Unexpected response from Banner. Try refreshing your credentials.",
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
          : `Session appears expired or credentials are invalid. Try reconnecting.`,
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
  const c = withSessionId(creds);
  await fetchUsageTracking(c);
  await saveTermStep(c, term);
  await confirmTermStep(c, term);
  await fetchUsageTracking(c);
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

  const c = withSessionId(creds);
  for (const code of courseCodes) {
    try {
      // Re-initialize term session for each search
      await initializeTermSession(c, term);

      const params = new URLSearchParams({
        txt_subjectcoursecombo: code,
        txt_term: term,
        startDatepicker: "",
        endDatepicker: "",
        uniqueSessionId: c.uniqueSessionId,
        pageOffset: "0",
        pageMaxSize: "500",
        sortColumn: "subjectDescription",
        sortDirection: "asc",
      });

      const res = await fetch(
        `${API_BASE}/ssb/searchResults/searchResults?${params}`,
        { headers: bannerHeaders(c) },
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

/** Fetch the student's actively registered sections for a given term */
export async function fetchRegistrations(
  creds: BannerCredentials,
  term: string,
): Promise<ActiveRegistration[]> {
  const params = new URLSearchParams({ term });
  const res = await fetch(
    `${API_BASE}/ssb/registrationHistory/renderActiveRegistrations?${params}`,
    { headers: bannerHeaders(creds) },
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  return (json?.data?.registrations as ActiveRegistration[]) ?? [];
}

// ---- Course registration ----

/**
 * Stage a single course section for registration.
 * Banner adds it to the pending cart and returns its full model.
 * The model must be echoed back in submitRegistrationBatch to commit.
 */
export async function stageAddRegistrationItem(
  creds: BannerCredentials,
  term: string,
  crn: string,
): Promise<RegistrationModel> {
  const params = new URLSearchParams({ term, courseReferenceNumber: crn, olr: "false" });
  const res = await fetch(
    `${API_BASE}/ssb/classRegistration/addRegistrationItem?${params}`,
    { headers: bannerHeaders(creds, REFERER_REGISTRATION) },
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  if (!json.success) throw new Error(json.message ?? `Banner rejected CRN ${crn}`);
  return json.model as RegistrationModel;
}

/**
 * Commit a batch of pending registration changes to Banner.
 * Pass the models from stageAddRegistrationItem; set selectedAction="DW" on
 * any model you want to drop instead of register.
 *
 * Returns per-CRN results filtered to only the CRNs present in updateModels.
 */
export async function submitRegistrationBatch(
  creds: BannerCredentials,
  updateModels: RegistrationModel[],
): Promise<RegistrationBatchResult> {
  const submittedCrns = new Set(updateModels.map((m) => m.courseReferenceNumber));

  const headers = bannerHeaders(creds, REFERER_REGISTRATION);
  headers["Content-Type"] = "application/json";
  headers["X-Banner-Origin"] = BANNER_ORIGIN;

  let res: Response;
  try {
    res = await fetch(`${API_BASE}/ssb/classRegistration/submitRegistration/batch`, {
      method: "POST",
      headers,
      body: JSON.stringify({ create: [], update: updateModels, destroy: [] }),
    });
  } catch (e) {
    return { success: false, items: [], error: e instanceof Error ? e.message : "Network error" };
  }

  if (!res.ok) {
    return { success: false, items: [], error: `HTTP ${res.status}` };
  }

  const json = await res.json();
  if (!json.success) {
    return { success: false, items: [], error: "Banner rejected the batch submission" };
  }

  const allUpdated: RegistrationModel[] = json.data?.update ?? [];

  const items: RegistrationItemResult[] = allUpdated
    .filter((item) => submittedCrns.has(item.courseReferenceNumber))
    .map((item) => {
      const crn = item.courseReferenceNumber;
      const finalStatus = item.courseRegistrationStatus;
      const errorFlag = (item.errorFlag as string | null) ?? null;
      const rawErrors = (item.crnErrors as Array<Record<string, unknown>> | undefined) ?? [];
      const errors = rawErrors.map((e) => ({
        message: typeof e.message === "string" ? e.message : JSON.stringify(e),
        messageType: typeof e.messageType === "string" ? e.messageType : "",
      }));
      // errorFlag "F" = fatal registration failure; "D" = duplicate-drop (not an error we submitted)
      const success = finalStatus === "RW" && errorFlag !== "F" && errors.length === 0;

      return {
        crn,
        courseTitle: (item.courseTitle as string | undefined) ?? crn,
        finalStatus,
        errorFlag,
        errors,
        success,
      };
    });

  return { success: true, items };
}

/**
 * Register a full schedule: stage each CRN then submit the batch.
 * Already-registered CRNs (isCurrentRegistration=true) are skipped.
 */
export async function registerSchedule(
  creds: BannerCredentials,
  term: string,
  crns: string[],
): Promise<RegistrationBatchResult> {
  const models: RegistrationModel[] = [];
  const stageErrors: string[] = [];

  for (const crn of crns) {
    try {
      const model = await stageAddRegistrationItem(creds, term, crn);
      models.push(model);
    } catch (e) {
      stageErrors.push(`CRN ${crn}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  if (models.length === 0) {
    return {
      success: false,
      items: [],
      error: `Could not stage any courses: ${stageErrors.join("; ")}`,
    };
  }

  const result = await submitRegistrationBatch(creds, models);

  if (stageErrors.length > 0) {
    result.error = [result.error, `Could not stage: ${stageErrors.join("; ")}`]
      .filter(Boolean)
      .join(" | ");
  }

  return result;
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
