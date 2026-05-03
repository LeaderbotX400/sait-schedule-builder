import { type BannerHostConfig, ssag6Url } from "../config/hosts";
import type { BannerCredentials, BannerTransport } from "../transport/types";
import { FORM_URLENCODED, formUrlEncoded } from "./forms";
import { bannerHeaders } from "./headers";
import type { SyncTokenCache } from "./syncToken";

/**
 * Owns per-session state shared across registration calls:
 * the unique-session id, the cached sync token, and whether a given term
 * has been "primed" via the saveTerm + term/search round-trip Banner needs
 * before searchResults will return rows.
 *
 * One instance per page load (the SDK facade constructs it). Components
 * never see this directly — they go through the typed facade.
 */
export class RegistrationSession {
  readonly transport: BannerTransport;
  readonly hosts: BannerHostConfig;
  readonly tokens: SyncTokenCache;
  uniqueSessionId: string;

  private primedTerm: string | null = null;

  constructor(
    transport: BannerTransport,
    hosts: BannerHostConfig,
    tokens: SyncTokenCache,
    uniqueSessionId: string,
  ) {
    this.transport = transport;
    this.hosts = hosts;
    this.tokens = tokens;
    this.uniqueSessionId = uniqueSessionId;
  }

  applyCredentials(creds: BannerCredentials): void {
    if (creds.synchronizerToken) this.tokens.set(creds.synchronizerToken);
    if (creds.uniqueSessionId) this.uniqueSessionId = creds.uniqueSessionId;
  }

  invalidate(): void {
    this.primedTerm = null;
    this.tokens.clear();
  }

  /**
   * Ensure Banner's per-session term state is bound to (uniqueSessionId, term).
   * Cheap when already primed; otherwise issues 4 calls.
   */
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
    headers: bannerHeaders({ syncToken: session.tokens.get() }),
  });
}

async function saveTerm(session: RegistrationSession, term: string): Promise<void> {
  const params = new URLSearchParams({
    mode: "registration",
    term,
    uniqueSessionId: session.uniqueSessionId,
  });
  await session.transport.fetch(ssag6Url(session.hosts, `/ssb/term/saveTerm?${params}`), {
    headers: bannerHeaders({ syncToken: session.tokens.get() }),
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
    headers: bannerHeaders({
      syncToken: session.tokens.get(),
      contentType: FORM_URLENCODED,
    }),
    body,
  });
}
