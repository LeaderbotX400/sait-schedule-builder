import type { RegistrationSession } from "../../core/session";
import { createEventsClient } from "./events";
import { createLookupsClient } from "./lookups";
import { createRegistrationsClient } from "./registrations";
import { createSearchClient } from "./search";
import { createSectionDetailsClient } from "./sectionDetails";
import { createTermsClient } from "./terms";

export function createRegistrationClient(session: RegistrationSession) {
  return {
    terms: createTermsClient(session),
    lookups: createLookupsClient(session),
    search: createSearchClient(session),
    sectionDetails: createSectionDetailsClient(session),
    registrations: createRegistrationsClient(session),
    events: createEventsClient(session),
  };
}

export type RegistrationClient = ReturnType<typeof createRegistrationClient>;
