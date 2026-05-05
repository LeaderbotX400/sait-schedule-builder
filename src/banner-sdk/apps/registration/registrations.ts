import { ssag6Url } from "../../config/hosts";
import { bannerRequest } from "../../core/request";
import type { RegistrationSession } from "../../core/session";
import type { ActiveRegistration } from "./types";

interface ActiveRegistrationsResponse {
  data?: { registrations?: ActiveRegistration[] };
}

export function createRegistrationsClient(session: RegistrationSession) {
  async function listActive(term: string): Promise<ActiveRegistration[]> {
    const params = new URLSearchParams({ term });
    const res = await bannerRequest<ActiveRegistrationsResponse>(
      session,
      ssag6Url(session.hosts, `/ssb/registrationHistory/renderActiveRegistrations?${params}`),
    );
    return res?.data?.registrations ?? [];
  }

  return { listActive };
}
