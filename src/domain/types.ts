// Pure domain types for the schedule builder. No React, no Banner shapes.
// Anything Banner-shaped lives in `src/banner-sdk/apps/<app>/types.ts`
// (currently still in `src/lib/types.ts` until step 3 migrates them).

export type DayOfWeek = "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";

export interface MeetingBlock {
  days: DayOfWeek[];
  /** HHMM 24-hour, e.g. 1400 = 2:00 PM, 800 = 8:00 AM. */
  startTime: number;
  endTime: number;
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

/** A course the user is currently registered for, with the section they're enrolled in. */
export interface CurrentRegistration {
  subjectCourse: string;
  currentSection: CourseSection;
  isIncluded: boolean;
}

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
  courseIds: string[];
  days: DayOfWeek[];
  /** [startTime, endTime] pairs in HHMM. */
  times: [number, number][];
}

export interface OmittedCourse {
  subjectCourse: string;
  reason: string;
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
  /** Selected courses NOT in this schedule, with a human-readable reason. */
  omittedCourses: OmittedCourse[];
  /** How well this schedule matches the user's blockout preferences (0-100). */
  blockoutFitScore: number;
}

/** Cell state for a single hour-slot on the blockout grid. */
export type BlockoutCell = "preferred" | "blocked" | "neutral";

/** Map of day → hour → cell state. */
export type BlockoutGrid = Record<DayOfWeek, Record<number, BlockoutCell>>;

export interface ScheduleRules {
  /** HHMM, string-typed for use with `<input type="time">`. */
  earliestStart: string;
  latestEnd: string;
  freeDays: DayOfWeek[];
  maxOnCampusDays: number;
  minTravelGapMinutes: number;
  preferClusteredCampusDays: boolean;
  allowPartialSchedules: boolean;
  maxGapBetweenClasses: number;
  requireOpenSeats: boolean;
  /**
   * Comma-separated list of allowed section-sequence prefixes (case-insensitive).
   * Empty string means "no filter — all sections allowed". Used by SAIT students
   * to lock the planner to their program's cohort sections (e.g. "SD" matches
   * SDA / SDB / SDC of cross-listed capstone courses).
   */
  sectionPrefixes: string;
  blockout: BlockoutGrid;
  /** 0-100 strength of the blockout-fit signal in the final score. */
  blockoutWeight: number;
}

export const WEEKDAYS: DayOfWeek[] = ["Mon", "Tue", "Wed", "Thu", "Fri"];
export const ALL_DAYS: DayOfWeek[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const GRID_HOURS = Array.from({ length: 15 }, (_, i) => i + 7); // 7am-9pm
