import type {
  BannerResponse,
  ActiveRegistration,
  RegistrationModel,
  RegistrationBatchResult,
  RegistrationItemResult,
} from "./types";

const BANNER_ORIGIN = "https://sait-sust-prd-prd1-ban-ss-ssag6.sait.ca";
const API_BASE = `${BANNER_ORIGIN}/StudentRegistrationSsb`;

export interface BannerCredentials {
  synchronizerToken: string;
  uniqueSessionId: string;
}

function withSessionId(creds: BannerCredentials): BannerCredentials {
  if (creds.uniqueSessionId) return creds;
  return { ...creds, uniqueSessionId: `sched${Date.now()}` };
}

/**
 * Build headers for Banner API requests.
 *
 * The browser attaches Banner cookies automatically (extension host_permissions
 * + credentials: 'include'). We only need to forward the synchronizer token.
 */
function bannerHeaders(creds: BannerCredentials): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/json, text/javascript, */*; q=0.01",
    "Cache-Control": "no-cache",
    Pragma: "no-cache",
    "X-Requested-With": "XMLHttpRequest",
  };
  if (creds.synchronizerToken) {
    headers["X-Synchronizer-Token"] = creds.synchronizerToken;
  }
  return headers;
}

const FETCH_INIT = { credentials: "include" as const };

// ---- Credential validation ----

export async function validateCredentials(
  creds: BannerCredentials,
): Promise<{ valid: boolean; error?: string }> {
  try {
    const params = new URLSearchParams({ searchTerm: "", offset: "1", max: "5" });
    const res = await fetch(
      `${API_BASE}/ssb/classSearch/getTerms?${params}`,
      { ...FETCH_INIT, headers: bannerHeaders(creds), signal: AbortSignal.timeout(10000) },
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
    const message = err instanceof Error ? err.message : "Unknown error during validation";
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

async function fetchUsageTracking(creds: BannerCredentials): Promise<void> {
  await fetch(`${API_BASE}/ssb/userPreference/fetchUsageTracking`, {
    ...FETCH_INIT,
    headers: bannerHeaders(creds),
  });
}

async function saveTermStep(creds: BannerCredentials, term: string): Promise<void> {
  const params = new URLSearchParams({
    mode: "registration",
    term,
    uniqueSessionId: creds.uniqueSessionId,
  });

  const res = await fetch(`${API_BASE}/ssb/term/saveTerm?${params}`, {
    ...FETCH_INIT,
    headers: bannerHeaders(creds),
  });

  if (!res.ok) throw new Error(`Failed to save term: ${res.status}`);
}

async function confirmTermStep(creds: BannerCredentials, term: string): Promise<void> {
  const body = new URLSearchParams({
    term,
    studyPath: "",
    studyPathText: "",
    startDatepicker: "",
    endDatepicker: "",
    uniqueSessionId: creds.uniqueSessionId,
  });

  const headers = bannerHeaders(creds);
  headers["Content-Type"] = "application/x-www-form-urlencoded; charset=UTF-8";

  await fetch(`${API_BASE}/ssb/term/search?mode=registration`, {
    ...FETCH_INIT,
    method: "POST",
    headers,
    body: body.toString(),
  });
}

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
  perCode: { code: string; count: number; error?: string }[];
}

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
        { ...FETCH_INIT, headers: bannerHeaders(c) },
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
    response: { success: true, totalCount: allData.length, data: allData },
    perCode,
  };
}

export async function getTerms(
  creds: BannerCredentials,
): Promise<{ code: string; description: string }[]> {
  const params = new URLSearchParams({ searchTerm: "", offset: "1", max: "20" });
  const res = await fetch(
    `${API_BASE}/ssb/classSearch/getTerms?${params}`,
    { ...FETCH_INIT, headers: bannerHeaders(creds) },
  );
  if (!res.ok) throw new Error(`Failed to fetch terms: ${res.status}`);
  return res.json();
}

export async function fetchRegistrations(
  creds: BannerCredentials,
  term: string,
): Promise<ActiveRegistration[]> {
  const params = new URLSearchParams({ term });
  const res = await fetch(
    `${API_BASE}/ssb/registrationHistory/renderActiveRegistrations?${params}`,
    { ...FETCH_INIT, headers: bannerHeaders(creds) },
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  return (json?.data?.registrations as ActiveRegistration[]) ?? [];
}

// ---- Course registration ----

export async function stageAddRegistrationItem(
  creds: BannerCredentials,
  term: string,
  crn: string,
): Promise<RegistrationModel> {
  const params = new URLSearchParams({ term, courseReferenceNumber: crn, olr: "false" });
  const res = await fetch(
    `${API_BASE}/ssb/classRegistration/addRegistrationItem?${params}`,
    { ...FETCH_INIT, headers: bannerHeaders(creds) },
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  if (!json.success) throw new Error(json.message ?? `Banner rejected CRN ${crn}`);
  return json.model as RegistrationModel;
}

export async function submitRegistrationBatch(
  creds: BannerCredentials,
  updateModels: RegistrationModel[],
): Promise<RegistrationBatchResult> {
  const submittedCrns = new Set(updateModels.map((m) => m.courseReferenceNumber));

  const headers = bannerHeaders(creds);
  headers["Content-Type"] = "application/json";

  let res: Response;
  try {
    res = await fetch(`${API_BASE}/ssb/classRegistration/submitRegistration/batch`, {
      ...FETCH_INIT,
      method: "POST",
      headers,
      body: JSON.stringify({ create: [], update: updateModels, destroy: [] }),
    });
  } catch (e) {
    return { success: false, items: [], error: e instanceof Error ? e.message : "Network error" };
  }

  if (!res.ok) return { success: false, items: [], error: `HTTP ${res.status}` };

  const json = await res.json();
  if (!json.success) return { success: false, items: [], error: "Banner rejected the batch submission" };

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

export async function searchSubjects(
  creds: BannerCredentials,
  term: string,
  searchTerm: string,
): Promise<{ code: string; description: string }[]> {
  const params = new URLSearchParams({ searchTerm, term, offset: "1", max: "50" });
  const res = await fetch(
    `${API_BASE}/ssb/classSearch/get_subjectcoursecombo?${params}`,
    { ...FETCH_INIT, headers: bannerHeaders(creds) },
  );
  if (!res.ok) return [];
  return res.json();
}
