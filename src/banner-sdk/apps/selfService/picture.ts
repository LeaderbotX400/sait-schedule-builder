import { type BannerHostConfig, ssag1Url } from "../../config/hosts";

export function pictureUrl(hosts: BannerHostConfig, bannerId: string): string {
  return ssag1Url(hosts, `/ssb/profile/picture?id=${encodeURIComponent(bannerId)}`);
}
