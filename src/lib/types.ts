// Banner-shape API types. These will move to src/banner-sdk/apps/<app>/types.ts
// in step 3; for now they live here so src/lib/api.ts can keep working
// unchanged.
//
// Pure domain types live in src/domain/types.ts.

// The opaque 127-field model Banner returns from addRegistrationItem and expects
// back in submitRegistration/batch. We only type the fields we interact with.
export type RegistrationModel = Record<string, unknown> & {
  courseReferenceNumber: string;
  courseRegistrationStatus: string;
  courseTitle?: string;
  selectedAction?: string | null;
};

export interface RegistrationItemResult {
  crn: string;
  courseTitle: string;
  /** Final courseRegistrationStatus from Banner (RW = registered, DW = dropped) */
  finalStatus: string;
  errorFlag: string | null;
  /** Structured errors from Banner's crnErrors array */
  errors: { message: string; messageType: string }[];
  success: boolean;
}

export interface RegistrationBatchResult {
  success: boolean;
  items: RegistrationItemResult[];
  /** Top-level error (before or instead of per-item results) */
  error?: string;
}

// ---- Banner search response ----

export interface BannerResponse {
  success: boolean;
  totalCount: number;
  data: BannerSection[];
}

export interface BannerSection {
  id: number;
  term: string;
  termDesc: string;
  courseReferenceNumber: string;
  partOfTerm: string;
  courseNumber: string;
  courseDisplay: string;
  subject: string;
  subjectDescription: string;
  sequenceNumber: string;
  campusDescription: string;
  scheduleTypeDescription: string;
  courseTitle: string;
  creditHours: number | null;
  maximumEnrollment: number;
  enrollment: number;
  seatsAvailable: number;
  waitCapacity: number;
  waitCount: number;
  waitAvailable: number;
  crossList: string | null;
  crossListCapacity: number | null;
  crossListCount: number | null;
  crossListAvailable: number | null;
  creditHourHigh: number | null;
  creditHourLow: number | null;
  creditHourIndicator: string | null;
  openSection: boolean;
  linkIdentifier: string | null;
  isSectionLinked: boolean;
  subjectCourse: string;
  faculty: BannerFaculty[];
  meetingsFaculty: BannerMeetingFaculty[];
  reservedSeatSummary: unknown;
  sectionAttributes: unknown[];
  instructionalMethod: string;
  instructionalMethodDescription: string;
}

export interface BannerFaculty {
  bannerId: string;
  category: string | null;
  class: string;
  courseReferenceNumber: string;
  displayName: string;
  emailAddress: string | null;
  primaryIndicator: boolean;
  term: string;
}

export interface BannerMeetingFaculty {
  category: string;
  class: string;
  courseReferenceNumber: string;
  faculty: BannerFaculty[];
  meetingTime: BannerMeetingTime;
  term: string;
}

export interface BannerMeetingTime {
  beginTime: string | null;
  building: string;
  buildingDescription: string;
  campus: string;
  campusDescription: string;
  category: string;
  class: string;
  courseReferenceNumber: string;
  creditHourSession: number;
  endDate: string;
  endTime: string | null;
  friday: boolean;
  hoursWeek: number;
  meetingScheduleType: string;
  meetingType: string;
  meetingTypeDescription: string;
  monday: boolean;
  room: string;
  saturday: boolean;
  startDate: string;
  sunday: boolean;
  term: string;
  thursday: boolean;
  tuesday: boolean;
  wednesday: boolean;
}

/** A single registration entry from /ssb/registrationHistory/renderActiveRegistrations */
export interface ActiveRegistration {
  subject: string;
  courseNumber: string;
  courseTitle: string;
  courseReferenceNumber: string;
  sequenceNumber: string;
  campusDescription: string;
  creditHour: number | null;
  instructionalMethodDescription: string;
  meetingTimes: BannerMeetingTime[];
  faculty: BannerFaculty[];
  instructorNames: string[];
  courseRegistrationStatusDescription: string;
}

export interface GpaResponse {
  overallGpa?: string;
  overallHours?: number;
  gpas?: Array<{
    gpa: string;
    hours: number;
    hoursAttempted: number;
    levelDesc: string;
    typeDesc: string;
    gpaTypeIndicatorDesc: string;
  }>;
}

export interface RegistrationNoticesResponse {
  standingAsOf?: {
    termDescription: string;
    standingDescription: string;
    fullDescription: string;
  };
  academicStanding?: {
    termDescription: string;
    description: string;
    preventsRegistration: unknown | null;
  };
  timeTickets?: Array<unknown>;
  enrollmentStatus?: Record<string, unknown>;
  regStudentStatus?: {
    allowsRegistration: boolean;
    description: string;
  };
  timeTicketRequired?: boolean;
  count?: number;
}

// ---- Re-exports from src/domain so existing consumers (src/components,
//      src/hooks, src/App.tsx) don't break during this step. They will be
//      replaced with direct `src/domain/*` imports as features migrate. ----

export { createEmptyBlockout, DEFAULT_RULES } from "../domain/blockout";
export { resolveCurrentSection, sectionsHaveConflict, timesOverlap } from "../domain/conflicts";
export type {
  BlockoutCell,
  BlockoutGrid,
  CourseSection,
  CurrentRegistration,
  DayOfWeek,
  MeetingBlock,
  OmittedCourse,
  Schedule,
  ScheduleRules,
  ScheduleWarning,
  WarningKind,
} from "../domain/types";
export { ALL_DAYS, GRID_HOURS, WEEKDAYS } from "../domain/types";
