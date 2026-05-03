// Re-export the StudentSelfService response shapes from the temporary home
// in src/lib/types. Will move into this file in a follow-up.

export type { GpaResponse, RegistrationNoticesResponse } from "../../../lib/types";

export interface HoldsCount {
  count?: number;
  [k: string]: unknown;
}

export interface RegisteredCourseList {
  data?: unknown;
  [k: string]: unknown;
}
