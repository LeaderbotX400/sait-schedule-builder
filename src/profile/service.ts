import { getSdk } from "../auth";
import { useProfileState } from "./state";

export async function loadProfile(studentId: string): Promise<void> {
  const state = useProfileState.getState();
  state.setBusy(true);
  state.setError(null);
  try {
    const sdk = getSdk();
    const [gpa, registeredCourses, curriculumHtml] = await Promise.all([
      sdk.selfService.profile.viewGPAHoursList(studentId),
      sdk.selfService.profile.viewRegisteredCourseList(studentId),
      sdk.selfService.profile.renderCurriculumTemplate(studentId),
    ]);
    state.setData({ gpa, registeredCourses, curriculumHtml });
  } catch (e) {
    state.setError(e instanceof Error ? e.message : String(e));
  } finally {
    state.setBusy(false);
  }
}
