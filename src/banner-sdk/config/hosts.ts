export interface BannerHostConfig {
  registration: string;
}

export const DEFAULT_HOSTS: BannerHostConfig = {
  registration: "https://sait-sust-prd-prd1-ban-ss-ssag6.sait.ca/StudentRegistrationSsb",
};

export function ssag6Url(hosts: BannerHostConfig, path: string): string {
  return `${hosts.registration}${path}`;
}
