import { useEffect, useRef } from "react";
import { forceReauth } from "../lib/extension";
import { useStore } from "../store";
import { getSdk } from "../store/sdk";

const REVALIDATION_INTERVAL_MS = 500 * 60 * 1000;

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

  // Auto-reauth when the poll (or SDK proxy) flags the session as expired.
  // reauthInProgress in the store keeps App.tsx on the main screen while the
  // popup is open; credentials are already null (markSessionExpired cleared them),
  // so no zombie Banner requests are made during the reauth window.
  useEffect(() => {
    if (!sessionExpired) return;
    let cancelled = false;
    (async () => {
      console.log("[sait-app] sessionExpired: starting silent reauth");
      const result = await forceReauth();
      if (cancelled) return;
      console.log("[sait-app] forceReauth result", {
        ok: result.ok,
        error: result.error,
        hasCreds: !!result.credentials,
      });
      if (!result.ok || !result.credentials) {
        // Reauth popup failed or was cancelled — show sign-in.
        // clearSessionExpired() before setCredentials(null): no await follows,
        // so the dep-change-induced cleanup firing cancelled=true doesn't matter.
        clearSessionExpired();
        setCredentials(null); // clears reauthInProgress → App.tsx shows SignInScreen
        return;
      }
      // connectAndValidate calls session.applyCredentials(creds) then validateLogin.
      // clearSessionExpired() must NOT be called before this await: it changes the
      // sessionExpired dep, fires cleanup (cancelled=true), and would prevent
      // setCredentials from ever being reached.
      const validation = await getSdk().connectAndValidate(result.credentials);
      console.log("[sait-app] connectAndValidate result", validation);
      if (cancelled) {
        // Component unmounted while connectAndValidate was in flight.
        // applyCredentials already ran inside connectAndValidate — undo it.
        getSdk().disconnect();
        return;
        // reauthInProgress stays true; on remount, sessionExpired:true re-fires
        // this effect and a new forceReauth() will complete the flow.
      }
      if (!validation.valid) {
        clearSessionExpired();
        setCredentials(null); // clears reauthInProgress → App.tsx shows SignInScreen
        return;
      }
      // Success: setCredentials(creds) sets sessionExpired:false + reauthInProgress:false
      // in one atomic update — no separate clearSessionExpired() needed.
      setCredentials(result.credentials, validation.studentId);
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionExpired, clearSessionExpired, setCredentials]);
}
