import { ssag6Url } from "../../config/hosts";
import { FORM_URLENCODED, formUrlEncoded } from "../../core/forms";
import { bannerHeaders } from "../../core/headers";
import { bannerRequestRaw } from "../../core/request";
import type { RegistrationSession } from "../../core/session";

export interface SectionDetailsArgs {
  term: string;
  courseReferenceNumber: string;
}

/**
 * The 14 POSTs Banner fires when the user clicks a course title in the cart
 * (each one drives a tab in the Class Details dialog). All accept the same
 * `term=…&courseReferenceNumber=…` form-urlencoded body and return a small
 * HTML or JSON fragment per section. We return the raw body and let UI
 * code render it directly; nothing here is structured enough to type
 * usefully today.
 */
const ENDPOINTS = [
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
] as const;

export type SectionDetailEndpoint = (typeof ENDPOINTS)[number];

export interface SectionDetailsBundle {
  /** Raw body (HTML fragment or JSON) keyed by endpoint name. */
  byEndpoint: Partial<Record<SectionDetailEndpoint, string>>;
  /** Endpoint names that errored, with the error messages. */
  errors: Partial<Record<SectionDetailEndpoint, string>>;
}

export function createSectionDetailsClient(session: RegistrationSession) {
  async function fetchOne(
    endpoint: SectionDetailEndpoint,
    args: SectionDetailsArgs,
  ): Promise<string> {
    const body = formUrlEncoded({
      term: args.term,
      courseReferenceNumber: args.courseReferenceNumber,
    });
    const raw = await bannerRequestRaw(
      session,
      ssag6Url(session.hosts, `/ssb/searchResults/${endpoint}`),
      {
        method: "POST",
        headers: bannerHeaders({
          syncToken: session.tokens.get(),
          contentType: FORM_URLENCODED,
        }),
        body,
      },
    );
    return raw.body;
  }

  async function fetchAll(args: SectionDetailsArgs): Promise<SectionDetailsBundle> {
    const out: SectionDetailsBundle = { byEndpoint: {}, errors: {} };
    await Promise.all(
      ENDPOINTS.map(async (endpoint) => {
        try {
          out.byEndpoint[endpoint] = await fetchOne(endpoint, args);
        } catch (e) {
          out.errors[endpoint] = e instanceof Error ? e.message : String(e);
        }
      }),
    );
    return out;
  }

  return { fetchOne, fetchAll, endpoints: ENDPOINTS };
}
