export interface GpaResponse {
  cumulativeGpa?: number | string;
  cumulativeHours?: number | string;
  termGpa?: number | string;
  termHours?: number | string;
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
