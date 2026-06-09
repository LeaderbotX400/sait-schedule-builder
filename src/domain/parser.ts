import type {
  ActiveRegistration,
  BannerMeetingTime,
  BannerResponse,
  BannerSection,
} from "../lib/types";
import type { CourseSection, DayOfWeek, MeetingBlock } from "./types";

/** Banner returns HTML-encoded text in some string fields (e.g. instructor names
 * with apostrophes come back as "O&#39;Loughlin"). Decode the common entities so
 * the UI doesn't render the raw codepoints. */
function decodeHtmlEntities(s: string): string {
  return s.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|amp|lt|gt|quot|apos);/g, (match, name: string) => {
    if (name.startsWith("#x")) return String.fromCodePoint(parseInt(name.slice(2), 16));
    if (name.startsWith("#")) return String.fromCodePoint(parseInt(name.slice(1), 10));
    switch (name) {
      case "amp": return "&";
      case "lt": return "<";
      case "gt": return ">";
      case "quot": return '"';
      case "apos": return "'";
      default: return match;
    }
  });
}

function clean(s: string | null | undefined): string {
  return s == null ? "" : decodeHtmlEntities(s);
}

const DAY_MAP: [keyof BannerMeetingTime, DayOfWeek][] = [
  ["monday", "Mon"],
  ["tuesday", "Tue"],
  ["wednesday", "Wed"],
  ["thursday", "Thu"],
  ["friday", "Fri"],
  ["saturday", "Sat"],
  ["sunday", "Sun"],
];

function parseMeetingTime(mt: BannerMeetingTime): MeetingBlock | null {
  if (!mt.beginTime || !mt.endTime) return null;

  const days: DayOfWeek[] = [];
  for (const [key, day] of DAY_MAP) {
    if (mt[key] === true) days.push(day);
  }
  if (days.length === 0) return null;

  const isOnline =
    mt.campus === "OL" || mt.campusDescription === "Online" || mt.buildingDescription === "Online";

  return {
    days,
    startTime: parseInt(mt.beginTime, 10),
    endTime: parseInt(mt.endTime, 10),
    building: clean(mt.buildingDescription),
    room: clean(mt.room),
    campus: clean(mt.campus),
    campusDescription: clean(mt.campusDescription),
    type: clean(mt.meetingTypeDescription),
    isOnline,
  };
}

function parseSection(section: BannerSection): CourseSection {
  const meetings: MeetingBlock[] = [];
  for (const mf of section.meetingsFaculty) {
    const block = parseMeetingTime(mf.meetingTime);
    if (block) meetings.push(block);
  }

  const primaryFaculty = section.faculty.find((f) => f.primaryIndicator);
  const instructor = clean(
    primaryFaculty?.displayName ?? section.faculty[0]?.displayName ?? "TBA",
  );

  return {
    identifier: `${section.subject}${section.courseNumber}-${section.sequenceNumber}`,
    subjectCourse: section.subjectCourse,
    title: clean(section.courseTitle),
    crn: section.courseReferenceNumber,
    instructor,
    sequenceNumber: section.sequenceNumber,
    seatsAvailable: section.seatsAvailable,
    maximumEnrollment: section.maximumEnrollment,
    enrollment: section.enrollment,
    meetings,
    creditHours: section.creditHours ?? section.creditHourLow,
    instructionalMethod: clean(section.instructionalMethodDescription),
  };
}

/** Parse a Banner API response into grouped course sections. */
export function parseBannerData(response: BannerResponse): Map<string, CourseSection[]> {
  // Two-level map: subjectCourse → crn → section.
  // Banner sometimes returns the same CRN multiple times (once per meeting pattern);
  // keying by CRN means the second row merges its meetings into the first instead of
  // creating a phantom duplicate section.
  const byCrn = new Map<string, Map<string, CourseSection>>();

  for (const section of response.data) {
    const course = parseSection(section);
    let crnMap = byCrn.get(course.subjectCourse);
    if (!crnMap) {
      crnMap = new Map();
      byCrn.set(course.subjectCourse, crnMap);
    }
    const existing = crnMap.get(course.crn);
    if (existing) {
      existing.meetings.push(...course.meetings);
    } else {
      crnMap.set(course.crn, course);
    }
  }

  return new Map([...byCrn.entries()].map(([name, crnMap]) => [name, [...crnMap.values()]]));
}

/**
 * Parse the renderActiveRegistrations response into grouped course sections.
 * Each course will have exactly one section — the one the student is enrolled in.
 *
 * Banner's endpoint accepts a term query param but does not reliably filter by
 * it server-side. Each registration's meetingTimes entries carry the real term
 * in `meetingTime.term`. When `termCode` is supplied we keep only registrations
 * whose first meetingTime term matches — dropping stale cross-term entries.
 */
export function parseActiveRegistrations(
  registrations: ActiveRegistration[],
  termCode?: string,
): Map<string, CourseSection[]> {
  const grouped = new Map<string, CourseSection[]>();

  // Only include actively enrolled registrations. "Registered-Sponsored" entries
  // are admin/sponsor placements that the student did not self-enroll in.
  const ACTIVE_STATUSES = ["Web Registered", "Registered", "Web Add"];
  const activeRegistrations = registrations.filter(
    (r) =>
      ACTIVE_STATUSES.some((s) => r.courseRegistrationStatusDescription.includes(s)) &&
      !r.courseRegistrationStatusDescription.includes("Sponsored"),
  );

  // Filter by term client-side: Banner doesn't reliably honour the term param.
  // A registration belongs to a term if:
  //   - it has no meetingTimes (online / independent-study courses — can't determine term, assume it belongs), OR
  //   - any meetingTime carries a falsy term field (Banner omitted it — assume it belongs), OR
  //   - any meetingTime's term matches termCode (coerce to string to handle number/string mismatch).
  // We only exclude a registration when ALL of its meetingTimes have an explicit, non-matching term.
  const termFiltered =
    termCode !== undefined
      ? activeRegistrations.filter(
          (r) =>
            r.meetingTimes.length === 0 ||
            r.meetingTimes.some((mt) => !mt.term || String(mt.term) === termCode),
        )
      : activeRegistrations;

  for (const reg of termFiltered) {
    const meetings: MeetingBlock[] = [];
    for (const mt of reg.meetingTimes) {
      const block = parseMeetingTime(mt);
      if (block) meetings.push(block);
    }

    const primaryFaculty = reg.faculty.find((f) => f.primaryIndicator);
    const instructor = clean(
      reg.instructorNames?.[0] ??
        primaryFaculty?.displayName ??
        reg.faculty[0]?.displayName ??
        "TBA",
    );

    const subjectCourse = `${reg.subject}${reg.courseNumber}`;

    const section: CourseSection = {
      identifier: `${subjectCourse}-${reg.sequenceNumber}`,
      subjectCourse,
      title: clean(reg.courseTitle),
      crn: reg.courseReferenceNumber,
      instructor,
      sequenceNumber: reg.sequenceNumber,
      seatsAvailable: 0,
      maximumEnrollment: 0,
      enrollment: 0,
      meetings,
      creditHours: reg.creditHour,
      instructionalMethod: clean(reg.instructionalMethodDescription),
      isCurrentRegistration: true,
    };

    grouped.set(subjectCourse, [section]);
  }

  return grouped;
}
