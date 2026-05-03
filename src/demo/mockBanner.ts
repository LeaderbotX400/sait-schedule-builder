import { MockTransport } from "../banner-sdk/transport/mock";
import {
  DEMO_ACTIVE_REGISTRATIONS,
  DEMO_BANNER_ID,
  DEMO_GPA,
  DEMO_REGISTRATION_NOTICES,
  DEMO_SUBJECT_SUGGESTIONS,
  DEMO_TERMS,
  searchResultsFor,
} from "./fixtures";

const JSON_HEADERS = { ok: true, status: 200, contentType: "application/json" } as const;

function json(body: unknown) {
  return { ...JSON_HEADERS, body: JSON.stringify(body) };
}

const okEmpty = json({});

/**
 * Build a MockTransport pre-loaded with realistic Banner responses for
 * every endpoint the demo flow needs to render the connected app:
 *
 *   - getBannerId (auth validation)
 *   - viewGPAHoursList + viewRegistrationNotices (profile status row)
 *   - getTerms + renderActiveRegistrations (auto-load)
 *   - userPreference + saveTerm + term/search (term-priming triplet)
 *   - searchResults + get_subjectcoursecombo (course search + autocomplete)
 *   - addRegistrationItem + submitRegistration/batch (register flow)
 */
export function createDemoTransport(): MockTransport {
  const t = new MockTransport();

  // ── Identity ────────────────────────────────────────────────────────
  t.on("/PersonalInformationDetails/getBannerId", json(DEMO_BANNER_ID));

  // ── Profile (ssag1) ─────────────────────────────────────────────────
  t.on("/studentProfile/viewGPAHoursList", json(DEMO_GPA));
  t.on("/studentProfile/viewRegistrationNotices", json(DEMO_REGISTRATION_NOTICES));
  t.on("/studentProfile/viewRegisteredCourseList", json({ data: [] }));
  t.on("/studentProfile/renderCurriculumTemplate", okEmpty);
  t.on("/studentHolds/getHoldsCountCacheHolds", json({ count: 0 }));

  // ── Terms ───────────────────────────────────────────────────────────
  t.on("/classSearch/getTerms", json(DEMO_TERMS));
  t.on("/classRegistration/getTerms", json(DEMO_TERMS.slice(0, 2)));

  // ── Auto-load registrations ─────────────────────────────────────────
  t.on("/registrationHistory/renderActiveRegistrations", json(DEMO_ACTIVE_REGISTRATIONS));

  // ── Term-priming triplet ────────────────────────────────────────────
  t.on("/userPreference/fetchUsageTracking", okEmpty);
  t.on("/term/saveTerm", okEmpty);
  t.on("/term/search", okEmpty);

  // ── Search + autocomplete ───────────────────────────────────────────
  t.on("/searchResults/searchResults", (call) => {
    const url = new URL(call.url);
    const code = url.searchParams.get("txt_subjectcoursecombo") ?? "";
    return json(searchResultsFor(code));
  });
  t.on("/classSearch/get_subjectcoursecombo", (call) => {
    const url = new URL(call.url);
    const q = (url.searchParams.get("searchTerm") ?? "").toUpperCase();
    return json(DEMO_SUBJECT_SUGGESTIONS.filter((s) => s.code.includes(q)));
  });

  // ── Section detail dialog (14 endpoints) — return empty bodies ─────
  for (const endpoint of [
    "getFacultyMeetingTimes",
    "getSectionCatalogDetails",
    "getClassDetails",
    "getCourseDescription",
    "getSyllabus",
    "getSectionAttributes",
    "getRestrictions",
    "getEnrollmentInfo",
    "getCorequisites",
    "getSectionPrerequisites",
    "getCourseMutuallyExclusions",
    "getLinkedSections",
    "getFees",
    "getSectionBookstoreDetails",
  ]) {
    t.on(`/searchResults/${endpoint}`, okEmpty);
  }

  // ── Other lookup endpoints ──────────────────────────────────────────
  for (const lookup of [
    "get_subject",
    "get_instructor",
    "get_campus",
    "get_attribute",
    "get_level",
    "get_partOfTerm",
    "get_session",
    "get_instructionalMethod",
  ]) {
    t.on(`/classSearch/${lookup}`, json([]));
  }

  // ── Registration cart ───────────────────────────────────────────────
  t.on("/classRegistration/getRegistrationEvents", json([]));
  t.on("/classRegistration/getMeetingInformationForRegistrations", json({}));

  // ── Stage + submit (mock success) ───────────────────────────────────
  t.on("/classRegistration/addRegistrationItem", (call) => {
    const url = new URL(call.url);
    const crn = url.searchParams.get("courseReferenceNumber") ?? "00000";
    return json({
      success: true,
      model: { courseReferenceNumber: crn, courseRegistrationStatus: "RW" },
    });
  });
  t.on("/classRegistration/submitRegistration/batch", (call) => {
    const body = JSON.parse(call.body ?? "{}") as {
      update?: Array<{ courseReferenceNumber: string }>;
    };
    const updates = (body.update ?? []).map((m) => ({
      courseReferenceNumber: m.courseReferenceNumber,
      courseRegistrationStatus: "RW",
      courseTitle: `Demo Course ${m.courseReferenceNumber}`,
      errorFlag: null,
      crnErrors: [],
    }));
    return json({ success: true, data: { update: updates } });
  });

  // ── Sync-token refresh page (registration HTML) ────────────────────
  t.on("/StudentRegistrationSsb/ssb/registration", {
    ok: true,
    status: 200,
    contentType: "text/html",
    body: '<html><meta name="synchronizerToken" content="demo-token-aaaa-bbbb-cccc"><body></body></html>',
  });

  return t;
}
