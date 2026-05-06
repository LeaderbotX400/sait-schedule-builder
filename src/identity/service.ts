import { getSdk } from "../auth";
import { useIdentityState } from "./state";

/** Validate the Banner session, populate `studentId`. Returns the id on success. */
export async function validateIdentity(): Promise<string | null> {
  const state = useIdentityState.getState();
  state.setBusy(true);
  state.setError(null);
  try {
    const result = await getSdk().general.identity.validateLogin();
    if (result.valid) {
      state.setStudentId(result.studentId);
      return result.studentId;
    }
    state.setStudentId(null);
    state.setError(result.error);
    return null;
  } catch (e) {
    state.setStudentId(null);
    state.setError(e instanceof Error ? e.message : String(e));
    return null;
  } finally {
    state.setBusy(false);
  }
}
