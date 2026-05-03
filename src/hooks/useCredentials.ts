// Thin compatibility shim over the new auth slice + useAuth side-effect hook.
// Existing components import this; step 5a migrates them to the store
// directly and deletes this file.

import type { BannerCredentials } from "../banner-sdk";
import type {
  GpaResponse,
  RegistrationNoticesResponse,
} from "../banner-sdk/apps/selfService/types";
import { useStore } from "../store";
import { useAuth } from "./useAuth";

export interface UseCredentialsReturn {
  credentials: BannerCredentials | null;
  studentId: string | null;
  sessionExpired: boolean;
  gpa: GpaResponse | null;
  registrationNotices: RegistrationNoticesResponse | null;
  setCredentials: (creds: BannerCredentials | null, studentId?: string | null) => void;
  clearSessionExpired: () => void;
  refreshProfile: () => Promise<void>;
}

export function useCredentials(): UseCredentialsReturn {
  // Drives the side effects that used to live inside this hook (revalidation
  // poll + auto-reauth + initial profile fetch). Mounting it here keeps the
  // call sites unchanged while step 4b moves the rest of the state.
  useAuth();

  const credentials = useStore((s) => s.credentials);
  const studentId = useStore((s) => s.studentId);
  const sessionExpired = useStore((s) => s.sessionExpired);
  const gpa = useStore((s) => s.gpa);
  const registrationNotices = useStore((s) => s.registrationNotices);
  const setCredentials = useStore((s) => s.setCredentials);
  const clearSessionExpired = useStore((s) => s.clearSessionExpired);
  const refreshProfile = useStore((s) => s.refreshProfile);

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
