import { useEffect } from "react";
import type { BannerCredentials } from "../banner-sdk";
import { DEMO_STUDENT_ID, isDemoMode } from "../demo";
import { useStore } from "../store";

const DEMO_CREDENTIALS: BannerCredentials = {
  synchronizerToken: "demo-token-aaaa-bbbb-cccc",
  uniqueSessionId: "demo-session",
};

/**
 * In demo mode (`?demo=1`), auto-call setCredentials on first mount so
 * SignInScreen is bypassed. Routes through the auth slice's
 * setCredentials action so the SDK's session.applyCredentials gets the
 * demo sync token; useScheduleSync then auto-loads against
 * MockTransport.
 *
 * No-op in normal mode.
 */
export function useDemoBootstrap(): void {
  const setCredentials = useStore((s) => s.setCredentials);
  const credentials = useStore((s) => s.credentials);

  useEffect(() => {
    if (!isDemoMode()) return;
    if (credentials) return;
    setCredentials(DEMO_CREDENTIALS, DEMO_STUDENT_ID);
  }, [credentials, setCredentials]);
}
