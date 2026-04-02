import type {
  BannerSection,
  BannerMeetingTime,
  BannerResponse,
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
    mt.campus === "OL" ||
    mt.campusDescription === "Online" ||
    mt.buildingDescription === "Online";

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

/** Parse raw JSON (file or API response) */
export function parseRawJson(json: unknown): Map<string, CourseSection[]> {
  const response = json as BannerResponse;
  if (!response.data || !Array.isArray(response.data)) {
    throw new Error("Invalid data format: expected { data: [...] }");
  }
  return parseBannerData(response);
}
