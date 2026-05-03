/**
 * Where Banner lives. Each app gets its own subdomain (per the live
 * inventory — see plan §1). Constructor accepts a `BannerHostConfig`
 * override so future test/dev tenants can be swapped in without touching
 * client code.
 */

export interface BannerHostConfig {
  /** /StudentRegistrationSsb on ssag6 — class search, registration, schedule details. */
  registration: string;
  /** /BannerGeneralSsb on ssag2 — personal info, getBannerId, events. */
  general: string;
  /** /StudentSelfService on ssag1 — student profile, GPA, holds. */
  selfService: string;
}

export const DEFAULT_HOSTS: BannerHostConfig = {
  registration: "https://sait-sust-prd-prd1-ban-ss-ssag6.sait.ca/StudentRegistrationSsb",
  general: "https://sait-sust-prd-prd1-ban-ss-ssag2.sait.ca/BannerGeneralSsb",
  selfService: "https://sait-sust-prd-prd1-ban-ss-ssag1.sait.ca/StudentSelfService",
};

export function ssag6Url(hosts: BannerHostConfig, path: string): string {
  return `${hosts.registration}${path}`;
}
export function ssag2Url(hosts: BannerHostConfig, path: string): string {
  return `${hosts.general}${path}`;
}
export function ssag1Url(hosts: BannerHostConfig, path: string): string {
  return `${hosts.selfService}${path}`;
}
