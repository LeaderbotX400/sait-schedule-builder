/**
 * Demo mode — swaps the chrome-extension transport for a MockTransport
 * pre-loaded with realistic Banner fixtures, and auto-seeds credentials
 * so the SignInScreen is bypassed.
 *
 * Toggle with `?demo=1` in the URL. Build-time toggle (VITE_DEMO=1)
 * also works for the production build.
 *
 * Use this for visual regression testing of UI primitives, demoing the
 * app without a real Banner login, or for CI snapshot tests later.
 */

const QUERY_FLAG = "demo";

export function isDemoMode(): boolean {
  if (typeof window !== "undefined") {
    const params = new URLSearchParams(window.location.search);
    if (params.get(QUERY_FLAG) === "1") return true;
  }
  if (typeof import.meta !== "undefined" && import.meta.env?.VITE_DEMO === "1") return true;
  return false;
}

export const DEMO_STUDENT_ID = "000999999";
export const DEMO_TERM = "202540";
