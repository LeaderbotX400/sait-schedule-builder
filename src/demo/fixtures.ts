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
    days: {
      mon?: boolean;
      tue?: boolean;
      wed?: boolean;
      thu?: boolean;
      fri?: boolean;
      sat?: boolean;
      sun?: boolean;
    };
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
  // ── CPRG306 – Database Programming ────────────────────────────────────
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
  // ── CPRG307 – Web Development 2 ───────────────────────────────────────
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
    subject: "CPRG",
    courseNumber: "307",
    sequence: "B",
    crn: "40401",
    title: "Web Development 2",
    instructor: "Prof. Michael Lee",
    meetings: [
      { days: { mon: true }, start: "1300", end: "1550", building: "AT", room: "104" },
      { days: { wed: true }, start: "0800", end: "0950", building: "AT", room: "104" },
    ],
    seats: 15,
    enrollment: 15,
    capacity: 30,
  },
  // ── CPRG310 – Programming Principles ─────────────────────────────────
  {
    subject: "CPRG",
    courseNumber: "310",
    sequence: "A",
    crn: "40420",
    title: "Programming Principles",
    instructor: "Dr. Alan Park",
    meetings: [
      { days: { mon: true }, start: "0900", end: "1050", building: "MA", room: "114" },
      { days: { wed: true }, start: "0900", end: "1150", building: "MA", room: "114" },
    ],
    seats: 10,
    enrollment: 20,
    capacity: 30,
  },
  {
    subject: "CPRG",
    courseNumber: "310",
    sequence: "B",
    crn: "40421",
    title: "Programming Principles",
    instructor: "Dr. Alan Park",
    meetings: [
      { days: { tue: true }, start: "1600", end: "1750", building: "MA", room: "114" },
      { days: { thu: true }, start: "1600", end: "1850", building: "MA", room: "114" },
    ],
    seats: 18,
    enrollment: 12,
    capacity: 30,
  },
  // ── CPRG315 – Data Structures & Algorithms ────────────────────────────
  {
    subject: "CPRG",
    courseNumber: "315",
    sequence: "A",
    crn: "40440",
    title: "Data Structures and Algorithms",
    instructor: "Prof. Priya Nair",
    meetings: [
      { days: { tue: true }, start: "1000", end: "1150", building: "MA", room: "225" },
      { days: { thu: true }, start: "1000", end: "1250", building: "MA", room: "225" },
    ],
    seats: 6,
    enrollment: 24,
    capacity: 30,
  },
  {
    subject: "CPRG",
    courseNumber: "315",
    sequence: "B",
    crn: "40441",
    title: "Data Structures and Algorithms",
    instructor: "Prof. Priya Nair",
    meetings: [
      {
        days: { fri: true },
        start: "1000",
        end: "1550",
        building: "AT",
        room: "208",
        online: true,
      },
    ],
    seats: 20,
    enrollment: 10,
    capacity: 30,
  },
  // ── EMTD400 – Emerging Trends ─────────────────────────────────────────
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
  // ── MATH220 – Applied Mathematics ─────────────────────────────────────
  {
    subject: "MATH",
    courseNumber: "220",
    sequence: "A",
    crn: "41100",
    title: "Applied Mathematics for Technology",
    instructor: "Dr. Fatima Malik",
    meetings: [
      { days: { mon: true }, start: "0800", end: "0850", building: "MA", room: "402" },
      { days: { wed: true }, start: "0800", end: "0850", building: "MA", room: "402" },
      { days: { fri: true }, start: "0800", end: "0850", building: "MA", room: "402" },
    ],
    seats: 5,
    enrollment: 25,
    capacity: 30,
  },
  {
    subject: "MATH",
    courseNumber: "220",
    sequence: "B",
    crn: "41101",
    title: "Applied Mathematics for Technology",
    instructor: "Prof. James Okafor",
    meetings: [
      { days: { tue: true }, start: "1100", end: "1150", building: "MA", room: "402" },
      { days: { thu: true }, start: "1100", end: "1250", building: "MA", room: "402" },
    ],
    seats: 14,
    enrollment: 16,
    capacity: 30,
  },
  // ── COMM250 – Technical Communication ────────────────────────────────
  {
    subject: "COMM",
    courseNumber: "250",
    sequence: "A",
    crn: "41200",
    title: "Technical Communication",
    instructor: "Ms. Rachel Torres",
    meetings: [{ days: { tue: true }, start: "1300", end: "1450", building: "AT", room: "312" }],
    seats: 22,
    enrollment: 8,
    capacity: 30,
  },
  {
    subject: "COMM",
    courseNumber: "250",
    sequence: "B",
    crn: "41201",
    title: "Technical Communication",
    instructor: "Ms. Rachel Torres",
    meetings: [
      {
        days: { wed: true },
        start: "1800",
        end: "1950",
        building: "AT",
        room: "312",
        online: true,
      },
    ],
    seats: 30,
    enrollment: 0,
    capacity: 30,
  },
  // ── PROJ300 – Project Management ──────────────────────────────────────
  {
    subject: "PROJ",
    courseNumber: "300",
    sequence: "A",
    crn: "41300",
    title: "IT Project Management",
    instructor: "Prof. Kevin Walsh",
    meetings: [
      { days: { mon: true }, start: "1500", end: "1650", building: "MA", room: "201" },
      { days: { thu: true }, start: "1500", end: "1650", building: "MA", room: "201" },
    ],
    seats: 9,
    enrollment: 21,
    capacity: 30,
  },
  {
    subject: "PROJ",
    courseNumber: "300",
    sequence: "B",
    crn: "41301",
    title: "IT Project Management",
    instructor: "Prof. Kevin Walsh",
    meetings: [
      {
        days: { sat: true },
        start: "0900",
        end: "1250",
        building: "MA",
        room: "201",
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
      MATH: "Mathematics",
      COMM: "Communications",
      PROJ: "Project Management",
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

// Pre-registered in the "currently enrolled" courses panel: CPRG306-A, EMTD400-A, CPRG307-A
const [cprg306a, , cprg307a, , , , , , emtd400a] = DEMO_CATALOG;
export const DEMO_ACTIVE_REGISTRATIONS = {
  data: {
    registrations: [activeReg(cprg306a!), activeReg(emtd400a!), activeReg(cprg307a!)],
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
  { code: "CPRG315", description: "CPRG315 - Data Structures and Algorithms" },
  { code: "EMTD400", description: "EMTD400 - Emerging Trends in Software Development" },
  { code: "MATH220", description: "MATH220 - Applied Mathematics for Technology" },
  { code: "COMM250", description: "COMM250 - Technical Communication" },
  { code: "PROJ300", description: "PROJ300 - IT Project Management" },
];
