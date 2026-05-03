import { type BannerHostConfig, ssag2Url } from "../../config/hosts";

/**
 * Profile-photo URL builder. Synchronous — the photo is just an `<img src>`.
 * No fetch needed; the browser handles auth via cookies.
 */
export function pictureUrl(hosts: BannerHostConfig, bannerId: string): string {
  return ssag2Url(
    hosts,
    `/ssb/PersonalInformationPicture/picture?bannerId=${encodeURIComponent(bannerId)}`,
  );
}
