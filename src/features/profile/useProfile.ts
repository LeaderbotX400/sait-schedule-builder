import { storeToRefs } from "pinia";
import { onUnmounted, watch } from "vue";
import { getSdk } from "@/lib/sdk";
import { useIdentityStore } from "@/features/identity/store";
import { useProfileStore } from "./store";

/**
 * Profile data loader composable. Mount once at the app root (App.vue).
 * Watches identity.studentId; fetches GPA + registration notices from Banner
 * when a student ID is available and resets on logout.
 */
export function useProfile(): void {
  const identityStore = useIdentityStore();
  const { studentId } = storeToRefs(identityStore);

  const profileStore = useProfileStore();

  // Cancellation token — incremented to discard results from a superseded load.
  let runId = 0;

  async function loadProfile(id: string): Promise<void> {
    const myRunId = ++runId;
    profileStore.setLoading(true);
    try {
      const sdk = getSdk();
      // Fire both requests concurrently — they hit independent endpoints.
      const [gpaResult, noticesResult] = await Promise.all([
        sdk.selfService.profile.viewGPAHoursList(id),
        sdk.selfService.profile.viewRegistrationNotices(id),
      ]);
      if (myRunId !== runId) return;
      profileStore.setGpa(gpaResult);
      profileStore.setRegistrationNotices(noticesResult);
    } finally {
      if (myRunId === runId) profileStore.setLoading(false);
    }
  }

  const stopWatch = watch(
    studentId,
    (id) => {
      if (id) {
        void loadProfile(id);
      } else {
        runId++; // discard any in-flight result
        profileStore.reset();
      }
    },
    { immediate: true },
  );

  onUnmounted(() => {
    runId++; // discard any in-flight result
    stopWatch();
  });
}
