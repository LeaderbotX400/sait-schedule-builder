/**
 * Canned Banner responses for demo mode. Shapes mirror what we recorded
 * during the live exploration in §3-§5 of the planning doc — small
 * enough to keep here, realistic enough to exercise every render path.
 */

import { DEMO_STUDENT_ID, DEMO_TERM } from "./index";

export const DEMO_TERMS = [
  { code: "202610", description: "Non-Credit 2026-2027" },
  { code: "202540", description: "Spring 2026" },
  { code: "202530", description: "Winter 2026" },
  { code: "202520", description: "Fall 2025" },
];

export const DEMO_GPA = {
  overallGpa: "3.85",
  overallHours: 60,
  gpas: [
    {
      gpa: "3.85",
      hours: 60,
      hoursAttempted: 60,
      levelDesc: "Diploma",
      typeDesc: "Overall",
      gpaTypeIndicatorDesc: "Overall",
    },
  ],
};

export const DEMO_REGISTRATION_NOTICES = {
  standingAsOf: {
    termDescription: "Spring 2026",
    standingDescription: "Good Standing",
    fullDescription: "Good Standing as of Spring 2026",
  },
  regStudentStatus: {
    allowsRegistration: true,
    description: "Registration open",
  },
  timeTickets: [],
  timeTicketRequired: false,
  count: 0,
};

interface DemoSection {
  subject: string;
  courseNumber: string;
  sequence: string;
  crn: string;
  title: string;
  instructor: string;
  meetings: Array<{
    days: { mon?: boolean; tue?: boolean; wed?: boolean; thu?: boolean; fri?: boolean };
    start: string; // HHMM
    end: string;
    building: string;
    room: string;
    online?: boolean;
  }>;
  seats: number;
  enrollment: number;
  capacity: number;
}

const DEMO_CATALOG: DemoSection[] = [
  {
    subject: "CPRG",
    courseNumber: "306",
    sequence: "A",
    crn: "40386",
    title: "Database Programming",
    instructor: "Dr. Sarah Chen",
    meetings: [
      { days: { mon: true }, start: "1000", end: "1150", building: "MA", room: "211" },
      { days: { wed: true }, start: "1200", end: "1450", building: "MA", room: "211" },
    ],
    seats: 4,
    enrollment: 26,
    capacity: 30,
  },
  {
    subject: "CPRG",
    courseNumber: "306",
    sequence: "B",
    crn: "40387",
    title: "Database Programming",
    instructor: "Prof. Michael Lee",
    meetings: [
      { days: { tue: true }, start: "1300", end: "1450", building: "MA", room: "211" },
      { days: { thu: true }, start: "1300", end: "1550", building: "MA", room: "211" },
    ],
    seats: 0,
    enrollment: 30,
    capacity: 30,
  },
  {
    subject: "CPRG",
    courseNumber: "307",
    sequence: "A",
    crn: "40400",
    title: "Web Development 2",
    instructor: "Dr. Janet Wu",
    meetings: [
      { days: { tue: true }, start: "1500", end: "1750", building: "AT", room: "104" },
      { days: { fri: true }, start: "0800", end: "0950", building: "AT", room: "104" },
    ],
    seats: 8,
    enrollment: 22,
    capacity: 30,
  },
  {
    subject: "EMTD",
    courseNumber: "400",
    sequence: "A",
    crn: "40832",
    title: "Emerging Trends in Software Development",
    instructor: "Prof. David Brown",
    meetings: [
      { days: { mon: true }, start: "1300", end: "1450", building: "MA", room: "319" },
      { days: { thu: true }, start: "1200", end: "1350", building: "MA", room: "319" },
    ],
    seats: 12,
    enrollment: 18,
    capacity: 30,
  },
  {
    subject: "EMTD",
    courseNumber: "400",
    sequence: "B",
    crn: "40833",
    title: "Emerging Trends in Software Development",
    instructor: "Prof. Lisa Green",
    meetings: [
      {
        days: { wed: true },
        start: "1500",
        end: "1750",
        building: "AT",
        room: "208",
        online: true,
      },
    ],
    seats: 25,
    enrollment: 5,
    capacity: 30,
  },
];

const DAY_KEY = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;
const DAY_FLAG = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

function bannerMeetingTime(m: DemoSection["meetings"][number], crn: string) {
  const flags: Record<string, boolean> = {};
  for (let i = 0; i < DAY_KEY.length; i++) {
    flags[DAY_KEY[i] as string] = !!m.days[DAY_FLAG[i] as keyof typeof m.days];
  }
  return {
    beginTime: m.start,
    building: m.building,
    buildingDescription: m.online
      ? "Online"
      : m.building === "MA"
        ? "Main Building"
        : "Aldred Centre",
    campus: m.online ? "OL" : "MAIN",
    campusDescription: m.online ? "Online" : "Main Campus",
    category: "01",
    class: "net.hedtech.banner.student.schedule.SectionSessionDecorator",
    courseReferenceNumber: crn,
    creditHourSession: 3,
    endDate: "08/14/2026",
    endTime: m.end,
    hoursWeek: 4,
    meetingScheduleType: "LEC",
    meetingType: "CLAS",
    meetingTypeDescription: "Class",
    room: m.room,
    startDate: "05/04/2026",
    term: DEMO_TERM,
    ...flags,
  } as Record<string, unknown>;
}

function bannerSection(s: DemoSection) {
  return {
    id: parseInt(s.crn, 10),
    term: DEMO_TERM,
    termDesc: "Spring 2026",
    courseReferenceNumber: s.crn,
    partOfTerm: "1",
    courseNumber: s.courseNumber,
    courseDisplay: `${s.subject} ${s.courseNumber}`,
    subject: s.subject,
    subjectDescription: subjectDescription(s.subject),
    sequenceNumber: s.sequence,
    campusDescription: "Main Campus",
    scheduleTypeDescription: "Lecture",
    courseTitle: s.title,
    creditHours: 3,
    maximumEnrollment: s.capacity,
    enrollment: s.enrollment,
    seatsAvailable: s.seats,
    waitCapacity: 0,
    waitCount: 0,
    waitAvailable: 0,
    crossList: null,
    crossListCapacity: null,
    crossListCount: null,
    crossListAvailable: null,
    creditHourHigh: null,
    creditHourLow: 3,
    creditHourIndicator: null,
    openSection: s.seats > 0,
    linkIdentifier: null,
    isSectionLinked: false,
    subjectCourse: `${s.subject}${s.courseNumber}`,
    faculty: [
      {
        bannerId: "999999",
        category: "01",
        class: "net.hedtech.banner.student.faculty.FacultyMemberDecorator",
        courseReferenceNumber: s.crn,
        displayName: s.instructor,
        emailAddress: "instructor@sait.ca",
        primaryIndicator: true,
        term: DEMO_TERM,
      },
    ],
    meetingsFaculty: s.meetings.map((m) => ({
      category: "01",
      class: "net.hedtech.banner.student.schedule.MeetingTimeDecorator",
      courseReferenceNumber: s.crn,
      faculty: [],
      meetingTime: bannerMeetingTime(m, s.crn),
      term: DEMO_TERM,
    })),
    reservedSeatSummary: null,
    sectionAttributes: [],
    instructionalMethod: "FACE",
    instructionalMethodDescription: "Face to face",
  };
}

function subjectDescription(subject: string): string {
  return (
    {
      CPRG: "Computer Programming",
      EMTD: "Emerging Tech Design",
    }[subject] ?? subject
  );
}

export function searchResultsFor(courseCode: string) {
  const upper = courseCode.toUpperCase().replace(/\s+/g, "");
  const matched = DEMO_CATALOG.filter(
    (s) => `${s.subject}${s.courseNumber}`.toUpperCase() === upper,
  );
  return {
    success: true,
    totalCount: matched.length,
    data: matched.map(bannerSection),
  };
}

export const DEMO_ACTIVE_REGISTRATIONS = {
  data: {
    registrations: [
      activeReg(DEMO_CATALOG[0]!),
      activeReg(DEMO_CATALOG[3]!),
      activeReg(DEMO_CATALOG[2]!),
    ],
  },
};

function activeReg(s: DemoSection) {
  return {
    subject: s.subject,
    courseNumber: s.courseNumber,
    courseTitle: s.title,
    courseReferenceNumber: s.crn,
    sequenceNumber: s.sequence,
    campusDescription: "Main Campus",
    creditHour: 3,
    instructionalMethodDescription: "Face to face",
    meetingTimes: s.meetings.map((m) => bannerMeetingTime(m, s.crn)),
    faculty: [
      {
        bannerId: "999999",
        category: "01",
        class: "net.hedtech.banner.student.faculty.FacultyMemberDecorator",
        courseReferenceNumber: s.crn,
        displayName: s.instructor,
        emailAddress: "instructor@sait.ca",
        primaryIndicator: true,
        term: DEMO_TERM,
      },
    ],
    instructorNames: [s.instructor],
    courseRegistrationStatusDescription: "Web Registered",
  };
}

export const DEMO_BANNER_ID = { bannerId: DEMO_STUDENT_ID };

export const DEMO_SUBJECT_SUGGESTIONS = [
  { code: "CPRG306", description: "CPRG306 - Database Programming" },
  { code: "CPRG307", description: "CPRG307 - Web Development 2" },
  { code: "CPRG310", description: "CPRG310 - Programming Principles" },
  { code: "EMTD400", description: "EMTD400 - Emerging Trends in Software Development" },
];
