import type {
  BannerResponse,
  ActiveRegistration,
  RegistrationModel,
  RegistrationBatchResult,
  RegistrationItemResult,
  GpaResponse,
  RegistrationNoticesResponse,
} from "./types";
import { bannerFetch } from "./extension";

const BANNER_ORIGIN = "https://sait-sust-prd-prd1-ban-ss-ssag6.sait.ca";
const API_BASE = `${BANNER_ORIGIN}/StudentRegistrationSsb`;
const GENERAL_SSB_BASE =
  "https://sait-sust-prd-prd1-ban-ss-ssag2.sait.ca/BannerGeneralSsb";
const STUDENT_SELF_SERVICE_BASE =
  "https://sait-sust-prd-prd1-ban-ss-ssag1.sait.ca/StudentSelfService";

export interface BannerCredentials {
  synchronizerToken: string;
  uniqueSessionId: string;
}

function withSessionId(creds: BannerCredentials): BannerCredentials {
  if (creds.uniqueSessionId) return creds;
  return { ...creds, uniqueSessionId: `sched${Date.now()}` };
}

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

interface ParsedResponse<T> {
  ok: boolean;
  status: number;
  contentType: string;
  json: T | null;
  text: string;
  error?: string;
}

async function bannerCall<T = unknown>(
  url: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string },
): Promise<ParsedResponse<T>> {
  const res = await bannerFetch(url, init);
  let json: T | null = null;
  if (
    res.ok &&
    (res.contentType.includes("application/json") ||
      res.contentType.includes("text/javascript"))
  ) {
    try {
      json = JSON.parse(res.body) as T;
    } catch {
      // leave json null; caller decides
    }
  }
  return {
    ok: res.ok,
    status: res.status,
    contentType: res.contentType,
    json,
    text: res.body,
    error: res.error,
  };
}

// ---- Login validation ----

export type LoginValidation =
  | { valid: true; studentId: string }
  | { valid: false; reason: "NETWORK" | "NOT_LOGGED_IN" | "MALFORMED"; error: string };

/**
 * Single source of truth for "is the user logged in?".
 *
 * Hits getBannerId on ssag2. Any of: network failure, non-2xx, redirect to
 * login (non-JSON response), empty body, missing/falsy bannerId — counts as
 * logged out per the user-facing reauth flow.
 */
export async function validateLogin(
  creds: BannerCredentials,
): Promise<LoginValidation> {
  const idRes = await bannerCall<{ bannerId?: string } | null>(
    `${GENERAL_SSB_BASE}/ssb/PersonalInformationDetails/getBannerId`,
    { headers: bannerHeaders(creds) },
  );

  if (idRes.error) {
    return {
      valid: false,
      reason: "NETWORK",
      error: `Could not reach Banner: ${idRes.error}`,
    };
  }

  if (!idRes.ok) {
    return {
      valid: false,
      reason: "NOT_LOGGED_IN",
      error: `Banner returned ${idRes.status}. Sign in and refresh your credentials.`,
    };
  }

  if (
    !idRes.contentType.includes("application/json") &&
    !idRes.contentType.includes("text/javascript")
  ) {
    return {
      valid: false,
      reason: "NOT_LOGGED_IN",
      error: "Session has expired — Banner redirected to login. Please refresh your credentials.",
    };
  }

  const bannerId = idRes.json?.bannerId;
  if (!bannerId) {
    return {
      valid: false,
      reason: "NOT_LOGGED_IN",
      error: "You're not signed in to SAIT Banner. Sign in and refresh your credentials.",
    };
  }

  return { valid: true, studentId: String(bannerId) };
}

// ---- Student profile fetchers ----

export async function fetchGpa(
  creds: BannerCredentials,
  studentId: string,
): Promise<GpaResponse | null> {
  const res = await bannerCall<GpaResponse>(
    `${STUDENT_SELF_SERVICE_BASE}/studentProfile/viewGPAHoursList?studentId=${encodeURIComponent(studentId)}`,
    { headers: bannerHeaders(creds) },
  );
  if (!res.ok || !res.json) return null;
  return res.json;
}

export async function fetchRegistrationNotices(
  creds: BannerCredentials,
  studentId: string,
): Promise<RegistrationNoticesResponse | null> {
  const res = await bannerCall<RegistrationNoticesResponse>(
    `${STUDENT_SELF_SERVICE_BASE}/studentProfile/viewRegistrationNotices?studentId=${encodeURIComponent(studentId)}`,
    { headers: bannerHeaders(creds) },
  );
  if (!res.ok || !res.json) return null;
  return res.json;
}

// ---- Session initialization ----

async function fetchUsageTracking(creds: BannerCredentials): Promise<void> {
  await bannerCall(`${API_BASE}/ssb/userPreference/fetchUsageTracking`, {
    headers: bannerHeaders(creds),
  });
}

async function saveTermStep(creds: BannerCredentials, term: string): Promise<void> {
  const params = new URLSearchParams({
    mode: "registration",
    term,
    uniqueSessionId: creds.uniqueSessionId,
  });
  const res = await bannerCall(`${API_BASE}/ssb/term/saveTerm?${params}`, {
    headers: bannerHeaders(creds),
  });
  if (!res.ok) throw new Error(`Failed to save term: ${res.status || res.error}`);
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
  await bannerCall(`${API_BASE}/ssb/term/search?mode=registration`, {
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

      const res = await bannerCall<BannerResponse>(
        `${API_BASE}/ssb/searchResults/searchResults?${params}`,
        { headers: bannerHeaders(c) },
      );

      if (!res.ok || !res.json) {
        perCode.push({ code, count: 0, error: res.error ?? `HTTP ${res.status}` });
        continue;
      }

      const json = res.json;
      const count = json.data?.length ?? 0;
      if (json.data && count > 0) allData.push(...json.data);
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
  const res = await bannerCall<{ code: string; description: string }[]>(
    `${API_BASE}/ssb/classSearch/getTerms?${params}`,
    { headers: bannerHeaders(creds) },
  );
  if (!res.ok || !res.json) {
    throw new Error(`Failed to fetch terms: ${res.error ?? res.status}`);
  }
  return res.json;
}

export async function fetchRegistrations(
  creds: BannerCredentials,
  term: string,
): Promise<ActiveRegistration[]> {
  const params = new URLSearchParams({ term });
  const res = await bannerCall<{ data?: { registrations?: ActiveRegistration[] } }>(
    `${API_BASE}/ssb/registrationHistory/renderActiveRegistrations?${params}`,
    { headers: bannerHeaders(creds) },
  );
  if (!res.ok) throw new Error(`HTTP ${res.error ?? res.status}`);
  return res.json?.data?.registrations ?? [];
}

// ---- Course registration ----

export async function stageAddRegistrationItem(
  creds: BannerCredentials,
  term: string,
  crn: string,
): Promise<RegistrationModel> {
  const params = new URLSearchParams({ term, courseReferenceNumber: crn, olr: "false" });
  const res = await bannerCall<{ success?: boolean; model?: RegistrationModel; message?: string }>(
    `${API_BASE}/ssb/classRegistration/addRegistrationItem?${params}`,
    { headers: bannerHeaders(creds) },
  );
  if (!res.ok) throw new Error(`HTTP ${res.error ?? res.status}`);
  if (!res.json?.success) throw new Error(res.json?.message ?? `Banner rejected CRN ${crn}`);
  return res.json.model as RegistrationModel;
}

export async function submitRegistrationBatch(
  creds: BannerCredentials,
  updateModels: RegistrationModel[],
): Promise<RegistrationBatchResult> {
  const submittedCrns = new Set(updateModels.map((m) => m.courseReferenceNumber));

  const headers = bannerHeaders(creds);
  headers["Content-Type"] = "application/json";

  const res = await bannerCall<{ success?: boolean; data?: { update?: RegistrationModel[] } }>(
    `${API_BASE}/ssb/classRegistration/submitRegistration/batch`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({ create: [], update: updateModels, destroy: [] }),
    },
  );

  if (res.error) return { success: false, items: [], error: res.error };
  if (!res.ok) return { success: false, items: [], error: `HTTP ${res.status}` };
  if (!res.json?.success) {
    return { success: false, items: [], error: "Banner rejected the batch submission" };
  }

  const allUpdated: RegistrationModel[] = res.json.data?.update ?? [];
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
  const res = await bannerCall<{ code: string; description: string }[]>(
    `${API_BASE}/ssb/classSearch/get_subjectcoursecombo?${params}`,
    { headers: bannerHeaders(creds) },
  );
  if (!res.ok || !res.json) return [];
  return res.json;
}
