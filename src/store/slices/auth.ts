import type { StateCreator } from "zustand";
import type { BannerCredentials } from "../../banner-sdk";
import type {
  GpaResponse,
  RegistrationNoticesResponse,
} from "../../banner-sdk/apps/selfService/types";
import { getSdk } from "../sdk";

/**
 * Auth slice — the SDK's "outside" layer. Owns the credentials blob, the
 * student id, the live GPA + registration-notices snapshot, and the
 * "session expired in the background" signal.
 *
 * Side effects (background poll, reauth popup) live in `useAuth.ts` so
 * they only run when the auth feature is mounted.
 */
export interface AuthSlice {
  credentials: BannerCredentials | null;
  studentId: string | null;
  sessionExpired: boolean;
  gpa: GpaResponse | null;
  registrationNotices: RegistrationNoticesResponse | null;

  /** Install credentials + studentId (no remote validation). */
  setCredentials: (creds: BannerCredentials | null, studentId?: string | null) => void;
  /** Clear the "session expired" flag once the UI has handled it. */
  clearSessionExpired: () => void;
  /** Mark the session as expired (background poll calls this). */
  markSessionExpired: () => void;
  /** Refetch GPA + notices using the current studentId. */
  refreshProfile: () => Promise<void>;
}

export const createAuthSlice: StateCreator<AuthSlice, [], [], AuthSlice> = (set, get) => ({
  credentials: null,
  studentId: null,
  sessionExpired: false,
  gpa: null,
  registrationNotices: null,

  setCredentials(creds, studentId) {
    if (creds) {
      getSdk().connect(creds);
      set({
        credentials: creds,
        studentId: studentId ?? null,
        sessionExpired: false,
      });
    } else {
      getSdk().disconnect();
      set({
        credentials: null,
        studentId: null,
        gpa: null,
        registrationNotices: null,
      });
    }
  },

  clearSessionExpired() {
    set({ sessionExpired: false });
  },

  markSessionExpired() {
    set({
      credentials: null,
      studentId: null,
      gpa: null,
      registrationNotices: null,
      sessionExpired: true,
    });
  },

  async refreshProfile() {
    const studentId = get().studentId;
    if (!studentId) return;
    const sdk = getSdk();
    const [gpa, notices] = await Promise.all([
      sdk.selfService.profile.viewGPAHoursList(studentId),
      sdk.selfService.profile.viewRegistrationNotices(studentId),
    ]);
    set({ gpa, registrationNotices: notices });
  },
});
