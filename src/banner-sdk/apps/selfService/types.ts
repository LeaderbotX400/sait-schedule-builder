export interface GpaEntry {
  gpa?: number | string;
  hours?: number | string;
  hoursAttempted?: number | string;
  levelDesc?: string;
  typeDesc?: string;
  [k: string]: unknown;
}

export interface GpaResponse {
  overallGpa?: number | string;
  overallHours?: number | string;
  gpas?: GpaEntry[];
  [k: string]: unknown;
}

export interface RegistrationNoticesResponse {
  registrationStatus?: {
    [k: string]: unknown;
  };
  /** Some payloads return a list of notice strings; others nest them. */
  notices?: unknown;
  /** Time ticket window — Banner exposes this under several keys depending on tenant. */
  timeTickets?: unknown;
  [k: string]: unknown;
}

export interface HoldsCount {
  count?: number;
  [k: string]: unknown;
}

export interface RegisteredCourseList {
  data?: unknown;
  [k: string]: unknown;
}
