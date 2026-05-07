import { getSdk } from "../auth";
import { createLogger } from "../lib/logger";
import { useProfileState } from "./state";

const log = createLogger("profile");

export async function loadProfile(studentId: string): Promise<void> {
  const state = useProfileState.getState();
  state.setBusy(true);
  state.setError(null);
  log.info(`loading profile for studentId=${studentId}`);
  try {
    const sdk = getSdk();
    const [gpa, registeredCourses, curriculumHtml] = await Promise.all([
      sdk.selfService.profile.viewGPAHoursList(studentId),
      sdk.selfService.profile.viewRegisteredCourseList(studentId),
      sdk.selfService.profile.renderCurriculumTemplate(studentId),
    ]);
    state.setData({ gpa, registeredCourses, curriculumHtml });

    // If every source failed, surface a single user-facing error. Per-endpoint
    // failures already get logged at warn level by the SDK methods.
    if (!gpa && !registeredCourses && !curriculumHtml) {
      const message = "Couldn't load profile data from Banner.";
      log.warn(message);
      state.setError(message);
      return;
    }
    if (!gpa) state.setError("Couldn't load GPA from Banner.");
    log.info(
      `profile loaded — gpa=${gpa?.overallGpa ?? "(none)"}, courses=${registeredCourses ? "ok" : "missing"}, curriculum=${curriculumHtml ? "ok" : "missing"}`,
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    log.error(`loadProfile threw — ${message}`, e);
    state.setError(message);
  } finally {
    state.setBusy(false);
  }
}
