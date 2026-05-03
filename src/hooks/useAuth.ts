import { useEffect, useRef } from "react";
import { forceReauth } from "../lib/extension";
import { useStore } from "../store";
import { getSdk } from "../store/sdk";

const REVALIDATION_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Side-effect hook for the auth feature: GPA/notices auto-fetch, background
 * session revalidation, and the auto-reauth flow on detected logout.
 *
 * Mount once at the top of the app (App.tsx). The store owns the state;
 * this hook just runs the timers/effects that depend on that state.
 */
export function useAuth(): void {
  const credentials = useStore((s) => s.credentials);
  const studentId = useStore((s) => s.studentId);
  const sessionExpired = useStore((s) => s.sessionExpired);
  const refreshProfile = useStore((s) => s.refreshProfile);
  const setCredentials = useStore((s) => s.setCredentials);
  const markSessionExpired = useStore((s) => s.markSessionExpired);
  const clearSessionExpired = useStore((s) => s.clearSessionExpired);

  // Initial profile fetch when studentId becomes known.
  useEffect(() => {
    if (!credentials || !studentId) return;
    void refreshProfile();
  }, [credentials, studentId, refreshProfile]);

  // Background revalidation poll: call validateLogin every 5 min while
  // connected. Authoritative-logout flips sessionExpired; network errors
  // are ignored. Paused while the tab is hidden.
  const credsRef = useRef(credentials);
  credsRef.current = credentials;
  useEffect(() => {
    if (!credentials) return;
    let cancelled = false;
    const tick = async () => {
      if (cancelled) return;
      if (typeof document !== "undefined" && document.hidden) return;
      if (!credsRef.current) return;
      const result = await getSdk().validateLogin();
      if (cancelled) return;
      if (!result.valid && result.reason !== "NETWORK") {
        markSessionExpired();
      } else if (result.valid && result.studentId !== studentId) {
        setCredentials(credsRef.current, result.studentId);
      }
    };
    const id = window.setInterval(tick, REVALIDATION_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [credentials, studentId, markSessionExpired, setCredentials]);

  // Auto-reauth when the poll flags the session as expired.
  useEffect(() => {
    if (!sessionExpired) return;
    let cancelled = false;
    (async () => {
      const result = await forceReauth();
      if (cancelled) return;
      clearSessionExpired();
      if (!result.ok || !result.credentials) return;
      const validation = await getSdk().connectAndValidate(result.credentials);
      if (cancelled || !validation.valid) return;
      setCredentials(result.credentials, validation.studentId);
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionExpired, clearSessionExpired, setCredentials]);
}
