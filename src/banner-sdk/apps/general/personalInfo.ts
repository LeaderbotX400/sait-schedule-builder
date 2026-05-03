import { type BannerHostConfig, ssag2Url } from "../../config/hosts";
import { bannerHeaders } from "../../core/headers";
import { bannerRequest } from "../../core/request";
import type { SyncTokenCache } from "../../core/syncToken";
import type { BannerTransport } from "../../transport/types";
import type {
  AddressEntry,
  EmailEntry,
  EmergencyContactEntry,
  PersonalDetails,
  PhoneEntry,
  PreferredName,
  UserName,
} from "./types";

interface Ctx {
  transport: BannerTransport;
  hosts: BannerHostConfig;
  tokens: SyncTokenCache;
}

function get<T>(ctx: Ctx, path: string): Promise<T> {
  return bannerRequest<T>(ctx, ssag2Url(ctx.hosts, path), { headers: bannerHeaders() });
}

/** All `/ssb/PersonalInformationDetails/get*` endpoints, typed. */
export function createPersonalInfoClient(
  transport: BannerTransport,
  hosts: BannerHostConfig,
  tokens: SyncTokenCache,
) {
  const ctx: Ctx = { transport, hosts, tokens };
  return {
    getPiConfig: () => get<unknown>(ctx, "/ssb/PersonalInformationDetails/getPiConfig"),
    getMaskingRules: () => get<unknown>(ctx, "/ssb/PersonalInformationDetails/getMaskingRules"),
    getUserName: () => get<UserName>(ctx, "/ssb/PersonalInformationDetails/getUserName"),
    getPreferredName: () =>
      get<PreferredName>(
        ctx,
        "/ssb/PersonalInformationDetails/getPreferredName?pageName=PersonalInformation&sectionName=Overview",
      ),
    getPersonalDetails: () =>
      get<PersonalDetails>(ctx, "/ssb/PersonalInformationDetails/getPersonalDetails"),
    getRaces: () => get<unknown>(ctx, "/ssb/PersonalInformationDetails/getRaces"),
    getAddresses: () => get<AddressEntry[]>(ctx, "/ssb/PersonalInformationDetails/getAddresses"),
    getTelephoneNumbers: () =>
      get<PhoneEntry[]>(ctx, "/ssb/PersonalInformationDetails/getTelephoneNumbers"),
    getEmails: () => get<EmailEntry[]>(ctx, "/ssb/PersonalInformationDetails/getEmails"),
    getEmergencyContacts: () =>
      get<EmergencyContactEntry[]>(ctx, "/ssb/PersonalInformationDetails/getEmergencyContacts"),
  };
}
