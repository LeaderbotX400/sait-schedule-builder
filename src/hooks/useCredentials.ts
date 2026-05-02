import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchGpa,
  fetchRegistrationNotices,
  validateLogin,
  type BannerCredentials,
} from "../lib/api";
import { forceReauth } from "../lib/extension";
import type {
  GpaResponse,
  RegistrationNoticesResponse,
} from "../lib/types";

const REVALIDATION_INTERVAL_MS = 5 * 60 * 1000;

export interface UseCredentialsReturn {
  credentials: BannerCredentials | null;
  studentId: string | null;
  sessionExpired: boolean;
  gpa: GpaResponse | null;
  registrationNotices: RegistrationNoticesResponse | null;
  setCredentials: (
    creds: BannerCredentials | null,
    studentId?: string | null,
  ) => void;
  clearSessionExpired: () => void;
  /** Re-fetch GPA + registration notices using the current credentials. */
  refreshProfile: () => Promise<void>;
}

/**
 * Owns Banner authentication state: credentials, studentId, GPA + notices,
 * session-expiry signal, and the background revalidation poll. Also drives
 * the auto-reauth flow when the polling detects an authoritative logout.
 */
export function useCredentials(): UseCredentialsReturn {
  const [credentials, setCredentialsState] =
    useState<BannerCredentials | null>(null);
  const [studentId, setStudentId] = useState<string | null>(null);
  const [gpa, setGpa] = useState<GpaResponse | null>(null);
  const [registrationNotices, setRegistrationNotices] =
    useState<RegistrationNoticesResponse | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);

  const setCredentials = useCallback<UseCredentialsReturn["setCredentials"]>(
    (creds, sid) => {
      setCredentialsState(creds);
      if (creds) {
        setSessionExpired(false);
        setStudentId(sid ?? null);
      } else {
        setStudentId(null);
        setGpa(null);
        setRegistrationNotices(null);
      }
    },
    [],
  );

  // Memoized so consumers (e.g. effect deps) get a stable reference.
  const clearSessionExpired = useCallback(() => setSessionExpired(false), []);

  const refreshProfile = useCallback(async () => {
    if (!credentials || !studentId) return;
    const [g, n] = await Promise.all([
      fetchGpa(credentials, studentId),
      fetchRegistrationNotices(credentials, studentId),
    ]);
    setGpa(g);
    setRegistrationNotices(n);
  }, [credentials, studentId]);

  // Fetch GPA + registration notices once we have a studentId.
  useEffect(() => {
    if (!credentials || !studentId) return;
    let cancelled = false;
    fetchGpa(credentials, studentId).then((g) => {
      if (!cancelled) setGpa(g);
    });
    fetchRegistrationNotices(credentials, studentId).then((n) => {
      if (!cancelled) setRegistrationNotices(n);
    });
    return () => {
      cancelled = true;
    };
  }, [credentials, studentId]);

  // Background re-validation: poll getBannerId every 5 minutes while
  // connected. On an authoritative logged-out result, clear state and
  // signal the auto-reauth flow below. Network errors do NOT clear state —
  // transient blips shouldn't log the user out. Pause polling while the
  // tab is hidden.
  const credsRef = useRef(credentials);
  credsRef.current = credentials;
  useEffect(() => {
    if (!credentials) return;

    let cancelled = false;
    const tick = async () => {
      if (cancelled) return;
      if (typeof document !== "undefined" && document.hidden) return;
      const creds = credsRef.current;
      if (!creds) return;
      const result = await validateLogin(creds);
      if (cancelled) return;
      if (!result.valid && result.reason !== "NETWORK") {
        setCredentialsState(null);
        setStudentId(null);
        setGpa(null);
        setRegistrationNotices(null);
        setSessionExpired(true);
      } else if (result.valid && result.studentId !== studentId) {
        setStudentId(result.studentId);
      }
    };

    const id = window.setInterval(tick, REVALIDATION_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [credentials, studentId]);

  // Auto-trigger a reauth popup when polling flags the session as expired.
  useEffect(() => {
    if (!sessionExpired) return;
    let cancelled = false;
    (async () => {
      const result = await forceReauth();
      if (cancelled) return;
      clearSessionExpired();
      if (!result.ok || !result.credentials) return;
      const validation = await validateLogin(result.credentials);
      if (cancelled || !validation.valid) return;
      setCredentials(result.credentials, validation.studentId);
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionExpired, clearSessionExpired, setCredentials]);

  return {
    credentials,
    studentId,
    sessionExpired,
    gpa,
    registrationNotices,
    setCredentials,
    clearSessionExpired,
    refreshProfile,
  };
}
