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
}

export interface Schedule {
  id: number;
  qualityScore: number;
  warnings: string[];
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
}

// User-configurable scheduling rules
export interface ScheduleRules {
  /** Earliest acceptable class start time, e.g. "0900" */
  earliestStart: string;
  /** Latest acceptable class end time, e.g. "1700" */
  latestEnd: string;
  /** Days the user wants to keep free (no classes) */
  freeDays: DayOfWeek[];
  /** Preferred max number of on-campus days per week */
  maxOnCampusDays: number;
  /** Minimum gap in minutes between an online and on-campus class */
  minTravelGapMinutes: number;
  /** Whether to prefer clustered on-campus days */
  preferClusteredCampusDays: boolean;
  /** Whether to allow partial schedules (missing some courses) */
  allowPartialSchedules: boolean;
  /** Preferred max gap between classes on the same day (minutes), 0 = no preference */
  maxGapBetweenClasses: number;
  /** Only show schedules with open seats */
  requireOpenSeats: boolean;
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
};

// Banner API session types
export interface BannerCredentials {
  cookies: string;
  synchronizerToken: string;
  baseUrl: string;
}
