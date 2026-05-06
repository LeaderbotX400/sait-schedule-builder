import { MockTransport } from "../banner-sdk/transport/mock";
import {
  DEMO_ACTIVE_REGISTRATIONS,
  DEMO_SUBJECT_SUGGESTIONS,
  DEMO_TERMS,
  searchResultsFor,
} from "./fixtures";

const JSON_HEADERS = { ok: true, status: 200, contentType: "application/json" } as const;

function json(body: unknown) {
  return { ...JSON_HEADERS, body: JSON.stringify(body) };
}

const okEmpty = json({});

export function createDemoTransport(): MockTransport {
  const t = new MockTransport();

  // ── Terms ───────────────────────────────────────────────────────────
  t.on("/classSearch/getTerms", json(DEMO_TERMS));

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

  // ── General app: identity ───────────────────────────────────────────
  t.on("/PersonalInformationDetails/getBannerId", json({ bannerId: "000123456" }));

  // ── SelfService: profile / holds ────────────────────────────────────
  t.on(
    "/studentProfile/viewGPAHoursList",
    json({ overallGpa: "3.85", overallHours: 42, gpas: [] }),
  );
  t.on(
    "/studentProfile/viewRegistrationNotices",
    json({
      registrationStatus: { eligible: true },
      notices: [],
      timeTickets: [{ start: "2026-04-01T09:00:00", end: "2026-04-30T23:59:59" }],
    }),
  );
  t.on("/studentProfile/viewRegisteredCourseList", json({ data: [] }));
  t.on("/studentProfile/renderCurriculumTemplate", {
    ok: true,
    status: 200,
    contentType: "text/html",
    body: "<div>Demo curriculum</div>",
  });
  t.on("/studentHolds/getHoldsCountCacheHolds", json({ count: 0 }));

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

  return t;
}
