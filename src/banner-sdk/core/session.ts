import { type BannerHostConfig, ssag6Url } from "../config/hosts";
import type { BannerTransport } from "../transport/types";
import { FORM_URLENCODED, formUrlEncoded } from "./forms";
import { bannerHeaders } from "./headers";
import type { BannerSdkHooks } from "./request";

export class RegistrationSession {
  readonly transport: BannerTransport;
  readonly hosts: BannerHostConfig;
  readonly hooks?: BannerSdkHooks;
  uniqueSessionId: string;

  private primedTerm: string | null = null;

  constructor(
    transport: BannerTransport,
    hosts: BannerHostConfig,
    uniqueSessionId: string,
    hooks?: BannerSdkHooks,
  ) {
    this.transport = transport;
    this.hosts = hosts;
    this.uniqueSessionId = uniqueSessionId;
    this.hooks = hooks;
  }

  invalidate(): void {
    this.primedTerm = null;
  }

  async ensureTermPrimed(term: string): Promise<void> {
    if (this.primedTerm === term) return;
    await fetchUsageTracking(this);
    await saveTerm(this, term);
    await termSearch(this, term);
    await fetchUsageTracking(this);
    this.primedTerm = term;
  }
}

async function fetchUsageTracking(session: RegistrationSession): Promise<void> {
  await session.transport.fetch(ssag6Url(session.hosts, "/ssb/userPreference/fetchUsageTracking"), {
    headers: bannerHeaders(),
  });
}

async function saveTerm(session: RegistrationSession, term: string): Promise<void> {
  const params = new URLSearchParams({
    mode: "registration",
    term,
    uniqueSessionId: session.uniqueSessionId,
  });
  await session.transport.fetch(ssag6Url(session.hosts, `/ssb/term/saveTerm?${params}`), {
    headers: bannerHeaders(),
  });
}

async function termSearch(session: RegistrationSession, term: string): Promise<void> {
  const body = formUrlEncoded({
    term,
    studyPath: "",
    studyPathText: "",
    startDatepicker: "",
    endDatepicker: "",
    uniqueSessionId: session.uniqueSessionId,
  });
  await session.transport.fetch(ssag6Url(session.hosts, "/ssb/term/search?mode=registration"), {
    method: "POST",
    headers: bannerHeaders({ contentType: FORM_URLENCODED }),
    body,
  });
}
