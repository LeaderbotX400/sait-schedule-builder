// Re-export Banner-shape types for the registration app from the temporary
// home in src/lib/types. These will move into this file in a follow-up
// when we slim src/lib/types further.

export type {
  ActiveRegistration,
  BannerFaculty,
  BannerMeetingFaculty,
  BannerMeetingTime,
  BannerResponse,
  BannerSection,
  RegistrationBatchResult,
  RegistrationItemResult,
  RegistrationModel,
} from "../../../lib/types";

export interface TermOption {
  code: string;
  description: string;
}

export interface RegistrationEvent {
  description?: string;
  termDescription?: string;
  /** Banner returns a heterogeneous shape; full fidelity isn't needed yet. */
  [k: string]: unknown;
}

export interface SearchPerCode {
  code: string;
  count: number;
  error?: string;
}
