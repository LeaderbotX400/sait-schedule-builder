// Banner cookie management — login detection + session wipe.

export const BANNER_DOMAIN = "sait-sust-prd-prd1-ban-ss-ssag6.sait.ca";

export async function checkCookies(): Promise<{ loggedIn: boolean }> {
  const cookies = await chrome.cookies.getAll({ domain: BANNER_DOMAIN });
  const map = Object.fromEntries(cookies.map((c) => [c.name, c.value]));
  return { loggedIn: !!(map.JSESSIONID && map.NLB) };
}

export async function clearBannerSession(): Promise<void> {
  const cookies = await chrome.cookies.getAll({ domain: BANNER_DOMAIN });
  await Promise.all(
    cookies.map((c) => {
      const url = `${c.secure ? "https" : "http"}://${c.domain.replace(/^\./, "")}${c.path}`;
      return chrome.cookies.remove({ url, name: c.name });
    }),
  );
}
