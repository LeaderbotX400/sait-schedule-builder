import { getSdk } from "../auth";
import { useRegistrationStatusState } from "./state";

export async function loadRegistrationStatus(studentId: string): Promise<void> {
  const state = useRegistrationStatusState.getState();
  state.setBusy(true);
  state.setError(null);
  try {
    const notices = await getSdk().selfService.profile.viewRegistrationNotices(studentId);
    state.setNotices(notices);
  } catch (e) {
    state.setError(e instanceof Error ? e.message : String(e));
  } finally {
    state.setBusy(false);
  }
}
