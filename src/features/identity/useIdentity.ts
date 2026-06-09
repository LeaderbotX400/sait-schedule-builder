import { storeToRefs } from "pinia";
import { onUnmounted, watch } from "vue";
import { useAuthStore } from "@/features/auth/store";
import { getSdk } from "@/lib/sdk";
import { useIdentityStore } from "./store";

/**
 * One-shot login validation composable. Mount once at the app root (App.vue).
 * Watches auth liveness + status; calls Banner's validateLogin when
 * authenticated and clears identity state on logout.
 */
export function useIdentity(): void {
  const auth = useAuthStore();
  const { status: authStatus, liveChecked } = storeToRefs(auth);

  const identityStore = useIdentityStore();

  // Cancellation token — incremented to discard stale in-flight results.
  let runId = 0;

  async function validateIdentity(): Promise<void> {
    const myRunId = ++runId;
    identityStore.setValidating(true);
    identityStore.setLastError(null);
    try {
      const result = await getSdk().general.identity.validateLogin();
      if (myRunId !== runId) return;
      if (result.valid) {
        identityStore.setStudentId(result.studentId);
      } else {
        identityStore.setStudentId(null);
        identityStore.setLastError(result.error);
      }
    } finally {
      if (myRunId === runId) identityStore.setValidating(false);
    }
  }

  const stopWatch = watch(
    [authStatus, liveChecked],
    ([status, checked]) => {
      // Wait for the live CHECK_LOGIN before firing — otherwise the persisted
      // "authenticated" state hydrates first and we hit Banner with stale
      // assumptions before the service worker confirms cookies are still valid.
      if (!checked) return;
      if (status === "authenticated") {
        void validateIdentity();
      } else {
        runId++; // discard any in-flight result
        identityStore.reset();
      }
    },
    { immediate: true },
  );

  onUnmounted(() => {
    runId++; // discard any in-flight result
    stopWatch();
  });
}
