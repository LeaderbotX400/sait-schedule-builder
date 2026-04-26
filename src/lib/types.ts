// Banner API response types — these match data.json structure exactly

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

// Processed/internal types

export type DayOfWeek = "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";

export interface MeetingBlock {
  days: DayOfWeek[];
  startTime: number; // e.g. 1400
  endTime: number; // e.g. 1650
  building: string;
  room: string;
  campus: string;
  campusDescription: string;
  type: string;
  isOnline: boolean;
}

export interface CourseSection {
  identifier: string; // e.g. "CPRG306-A"
  subjectCourse: string; // e.g. "CPRG306"
  title: string;
  crn: string;
  instructor: string;
  sequenceNumber: string;
  seatsAvailable: number;
  maximumEnrollment: number;
  enrollment: number;
  meetings: MeetingBlock[];
  creditHours: number | null;
  instructionalMethod: string;
  /** Whether this section is part of the user's current registration from Banner */
  isCurrentRegistration?: boolean;
}

/** Represents a course that the user is currently registered for with a specific section */
export interface CurrentRegistration {
  subjectCourse: string; // e.g. "CPRG306"
  currentSection: CourseSection; // The section they're currently enrolled in
  isIncluded: boolean; // Whether this course should be included in the current schedule view
}

// Structured warning — carries enough info to highlight the problem in the UI
export type WarningKind =
  | "early_morning"
  | "travel_gap"
  | "campus_days"
  | "large_gap"
  | "partial"
  | "blockout_conflict";

export interface ScheduleWarning {
  kind: WarningKind;
  message: string;
  /** Course identifiers involved */
  courseIds: string[];
  /** Days involved */
  days: DayOfWeek[];
  /** Specific time ranges that are problematic: [startTime, endTime] */
  times: [number, number][];
}

export interface Schedule {
  id: number;
  qualityScore: number;
  warnings: ScheduleWarning[];
  courses: CourseSection[];
  daysUsed: DayOfWeek[];
  daysCount: number;
  onCampusDays: DayOfWeek[];
  onCampusDaysCount: number;
  onCampusPerDay: Record<string, number>;
  earlyMorningPenalty: number;
  travelTimePenalty: number;
  isPartial: boolean;
  omittedCourses: string[];
  /** How well this schedule matches the user's blockout preferences (0-100, higher=better) */
  blockoutFitScore: number;
}

// ---- Blockout / ideal schedule shape ----

/**
 * Cell state for a single hour-slot on the blockout grid.
 * - "preferred": user wants classes here
 * - "blocked": user does NOT want classes here
 * - "neutral": no preference
 */
export type BlockoutCell = "preferred" | "blocked" | "neutral";

/** Map of day -> hour -> cell state */
export type BlockoutGrid = Record<DayOfWeek, Record<number, BlockoutCell>>;

// User-configurable scheduling rules
export interface ScheduleRules {
  earliestStart: string;
  latestEnd: string;
  freeDays: DayOfWeek[];
  maxOnCampusDays: number;
  minTravelGapMinutes: number;
  preferClusteredCampusDays: boolean;
  allowPartialSchedules: boolean;
  maxGapBetweenClasses: number;
  requireOpenSeats: boolean;
  /** User-painted ideal schedule shape */
  blockout: BlockoutGrid;
  /** How strongly blockout preferences affect scoring (0-100) */
  blockoutWeight: number;
}

export const WEEKDAYS: DayOfWeek[] = ["Mon", "Tue", "Wed", "Thu", "Fri"];
export const ALL_DAYS: DayOfWeek[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const GRID_HOURS = Array.from({ length: 15 }, (_, i) => i + 7); // 7am-9pm

export function createEmptyBlockout(): BlockoutGrid {
  const grid = {} as BlockoutGrid;
  for (const day of ALL_DAYS) {
    grid[day] = {};
    for (const hour of GRID_HOURS) {
      grid[day][hour] = "neutral";
    }
  }
  return grid;
}

export const DEFAULT_RULES: ScheduleRules = {
  earliestStart: "0800",
  latestEnd: "2100",
  freeDays: [],
  maxOnCampusDays: 5,
  minTravelGapMinutes: 60,
  preferClusteredCampusDays: true,
  allowPartialSchedules: false,
  maxGapBetweenClasses: 0,
  requireOpenSeats: false,
  blockout: createEmptyBlockout(),
  blockoutWeight: 50,
};

/** Utility: check if two time ranges overlap on the same day */
export function timesOverlap(
  start1: number,
  end1: number,
  start2: number,
  end2: number,
): boolean {
  return start1 < end2 && start2 < end1;
}

/** Utility: check if two course sections have any time conflicts */
export function sectionsHaveConflict(a: CourseSection, b: CourseSection): boolean {
  for (const ma of a.meetings) {
    for (const mb of b.meetings) {
      const sharedDays = ma.days.filter((d) => mb.days.includes(d));
      if (sharedDays.length === 0) continue;
      if (timesOverlap(ma.startTime, ma.endTime, mb.startTime, mb.endTime)) {
        return true;
      }
    }
  }
  return false;
}
