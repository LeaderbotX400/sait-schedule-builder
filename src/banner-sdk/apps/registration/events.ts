import { ssag6Url } from "../../config/hosts";
import { bannerRequest } from "../../core/request";
import type { RegistrationSession } from "../../core/session";
import type { RegistrationEvent } from "./types";

/** Notices banner + meeting-grid endpoints used by the registration cart UI. */
export function createEventsClient(session: RegistrationSession) {
  return {
    /** Notices Banner shows above the cart (deadlines, holds, etc.). */
    async getRegistrationEvents(termFilter = ""): Promise<RegistrationEvent[]> {
      const params = new URLSearchParams({ termFilter });
      return bannerRequest<RegistrationEvent[]>(
        session,
        ssag6Url(session.hosts, `/ssb/classRegistration/getRegistrationEvents?${params}`),
      );
    },

    /** Meeting times for the schedule-grid view of currently-registered classes. */
    async getMeetingInformationForRegistrations(): Promise<unknown> {
      return bannerRequest<unknown>(
        session,
        ssag6Url(session.hosts, "/ssb/classRegistration/getMeetingInformationForRegistrations"),
      );
    },
  };
}
