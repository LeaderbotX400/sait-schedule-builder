import { type BannerHostConfig, ssag2Url } from "../../config/hosts";
import { bannerHeaders } from "../../core/headers";
import { bannerRequest } from "../../core/request";
import type { SyncTokenCache } from "../../core/syncToken";
import type { BannerTransport } from "../../transport/types";
import type { CodeOption } from "./types";

interface Ctx {
  transport: BannerTransport;
  hosts: BannerHostConfig;
  tokens: SyncTokenCache;
}

function get(ctx: Ctx, name: string) {
  return () =>
    bannerRequest<CodeOption[]>(
      ctx,
      ssag2Url(ctx.hosts, `/ssb/PersonalInformationDetails/${name}`),
      {
        headers: bannerHeaders(),
      },
    );
}

/** Lookup lists used by the personal-info edit dialogs (state, nation, etc.). */
export function createGeneralLookupsClient(
  transport: BannerTransport,
  hosts: BannerHostConfig,
  tokens: SyncTokenCache,
) {
  const ctx: Ctx = { transport, hosts, tokens };
  return {
    emailTypes: get(ctx, "getEmailTypeList"),
    addressTypes: get(ctx, "getAddressTypeList"),
    nations: get(ctx, "getNationList"),
    states: get(ctx, "getStateList"),
    counties: get(ctx, "getCountyList"),
    relationships: get(ctx, "getRelationshipList"),
    maritalStatuses: get(ctx, "getMaritalStatusList"),
    genders: get(ctx, "getGenderList"),
    pronouns: get(ctx, "getPronounList"),
  };
}
