export type {
  ActiveRegistration,
  BannerFaculty,
  BannerMeetingFaculty,
  BannerMeetingTime,
  BannerResponse,
  BannerSection,
} from "../../../lib/types";

export interface TermOption {
  code: string;
  description: string;
}

export interface SearchPerCode {
  code: string;
  count: number;
  error?: string;
}
