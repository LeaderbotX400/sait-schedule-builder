import type { RegistrationSession } from "../../core/session";
import { createLookupsClient } from "./lookups";
import { createRegistrationsClient } from "./registrations";
import { createSearchClient } from "./search";
import { createTermsClient } from "./terms";

export function createRegistrationClient(session: RegistrationSession) {
  return {
    terms: createTermsClient(session),
    lookups: createLookupsClient(session),
    search: createSearchClient(session),
    registrations: createRegistrationsClient(session),
  };
}

export type RegistrationClient = ReturnType<typeof createRegistrationClient>;
