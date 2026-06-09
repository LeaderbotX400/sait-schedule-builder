import { storeToRefs } from "pinia";
import { onUnmounted, watch } from "vue";
import { getSdk } from "@/lib/sdk";
import { useIdentityStore } from "@/features/identity/store";
import { useHoldsStore } from "./store";

/**
 * Holds count loader composable. Mount once at the app root (App.vue).
 * Watches identity.studentId; fetches the Banner holds count when a student
 * ID is available and resets on logout. null count means unknown — UI decides
 * whether to hide or show a question mark.
 */
export function useHolds(): void {
  const identityStore = useIdentityStore();
  const { studentId } = storeToRefs(identityStore);

  const holdsStore = useHoldsStore();

  // Cancellation token — incremented to discard results from a superseded load.
  let runId = 0;

  async function loadHolds(id: string): Promise<void> {
    const myRunId = ++runId;
    holdsStore.setLoading(true);
    try {
      const result = await getSdk().selfService.holds.getHoldsCount(id);
      if (myRunId !== runId) return;
      // SDK returns null on failure; treat null count as unknown.
      holdsStore.setCount(result?.count ?? null);
    } finally {
      if (myRunId === runId) holdsStore.setLoading(false);
    }
  }

  const stopWatch = watch(
    studentId,
    (id) => {
      if (id) {
        void loadHolds(id);
      } else {
        runId++; // discard any in-flight result
        holdsStore.reset();
      }
    },
    { immediate: true },
  );

  onUnmounted(() => {
    runId++; // discard any in-flight result
    stopWatch();
  });
}
