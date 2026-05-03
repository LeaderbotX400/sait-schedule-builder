import { type BannerHostConfig, ssag1Url } from "../../config/hosts";

/**
 * Student-photo URL builder. Synchronous; the browser handles auth via
 * cookies when the URL is used as `<img src>`.
 */
export function pictureUrl(hosts: BannerHostConfig, bannerId: string): string {
  return ssag1Url(hosts, `/ssb/studentPicture/picture?bannerId=${encodeURIComponent(bannerId)}`);
}
