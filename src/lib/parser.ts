import type {
  ActiveRegistration,
  BannerMeetingTime,
  BannerResponse,
  BannerSection,
  CourseSection,
  DayOfWeek,
  MeetingBlock,
} from "./types";

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
    building: mt.buildingDescription,
    room: mt.room,
    campus: mt.campus,
    campusDescription: mt.campusDescription,
    type: mt.meetingTypeDescription,
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
  const instructor = primaryFaculty?.displayName ?? section.faculty[0]?.displayName ?? "TBA";

  return {
    identifier: `${section.subject}${section.courseNumber}-${section.sequenceNumber}`,
    subjectCourse: section.subjectCourse,
    title: section.courseTitle,
    crn: section.courseReferenceNumber,
    instructor,
    sequenceNumber: section.sequenceNumber,
    seatsAvailable: section.seatsAvailable,
    maximumEnrollment: section.maximumEnrollment,
    enrollment: section.enrollment,
    meetings,
    creditHours: section.creditHours ?? section.creditHourLow,
    instructionalMethod: section.instructionalMethodDescription,
  };
}

/** Parse a Banner API response into grouped course sections */
export function parseBannerData(response: BannerResponse): Map<string, CourseSection[]> {
  const grouped = new Map<string, CourseSection[]>();

  for (const section of response.data) {
    const course = parseSection(section);
    const existing = grouped.get(course.subjectCourse);
    if (existing) {
      existing.push(course);
    } else {
      grouped.set(course.subjectCourse, [course]);
    }
  }

  return grouped;
}

/**
 * Parse the renderActiveRegistrations response into grouped course sections.
 * Each course will have exactly one section — the one the student is enrolled in.
 */
export function parseActiveRegistrations(
  registrations: ActiveRegistration[],
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

  for (const reg of activeRegistrations) {
    const meetings: MeetingBlock[] = [];
    for (const mt of reg.meetingTimes) {
      const block = parseMeetingTime(mt);
      if (block) meetings.push(block);
    }

    const primaryFaculty = reg.faculty.find((f) => f.primaryIndicator);
    const instructor =
      reg.instructorNames?.[0] ??
      primaryFaculty?.displayName ??
      reg.faculty[0]?.displayName ??
      "TBA";

    const subjectCourse = `${reg.subject}${reg.courseNumber}`;

    const section: CourseSection = {
      identifier: `${subjectCourse}-${reg.sequenceNumber}`,
      subjectCourse,
      title: reg.courseTitle,
      crn: reg.courseReferenceNumber,
      instructor,
      sequenceNumber: reg.sequenceNumber,
      seatsAvailable: 0,
      maximumEnrollment: 0,
      enrollment: 0,
      meetings,
      creditHours: reg.creditHour,
      instructionalMethod: reg.instructionalMethodDescription,
      isCurrentRegistration: true,
    };

    grouped.set(subjectCourse, [section]);
  }

  return grouped;
}
