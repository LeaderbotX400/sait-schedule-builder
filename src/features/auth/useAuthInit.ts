import { useDocumentVisibility, useIntervalFn } from "@vueuse/core";
import { storeToRefs } from "pinia";
import { onMounted, watch } from "vue";
import { useAsyncTask } from "@/composables/useAsyncTask";
import { getSdk } from "@/lib/sdk";
import { getAuthService } from "./service";
import { useAuthStore } from "./store";

/** Periodic CHECK_LOGIN — catches server-side expiry without waiting on a Banner request. */
const POLL_INTERVAL_MS = 60 * 1000;
/** Bumps store.tick so age-derived `computed`s re-evaluate. */
const AGE_TICK_INTERVAL_MS = 10 * 1000;

/**
 * Mount once at the root component (App.vue). Hydrates auth state,
 * starts the background tickers (live-status poll, age clock,
 * visibility re-check), and resolves the Banner-level studentId via
 * validateLogin whenever the session becomes live-checked authenticated.
 */
export function useAuthInit(): void {
  const auth = useAuthStore();
  const { status, liveChecked } = storeToRefs(auth);

  onMounted(() => void getAuthService().init());

  useIntervalFn(() => void getAuthService().refresh(), POLL_INTERVAL_MS);
  useIntervalFn(() => auth.bumpTick(), AGE_TICK_INTERVAL_MS);

  const visibility = useDocumentVisibility();
  watch(visibility, (state) => {
    if (state === "visible") void getAuthService().refresh();
  });

  const validateTask = useAsyncTask(
    async (ctx) => {
      auth.setValidating(true);
      try {
        const result = await getSdk().general.identity.validateLogin();
        if (ctx.isStale()) return null;
        auth.setStudentId(result.valid ? result.studentId : null);
        return result;
      } finally {
        if (!ctx.isStale()) auth.setValidating(false);
      }
    },
  );

  watch(
    [status, liveChecked],
    ([s, checked]) => {
      if (checked && s === "authenticated") {
        void validateTask.run();
      } else {
        validateTask.cancel();
        auth.setStudentId(null);
        auth.setValidating(false);
      }
    },
    { immediate: true },
  );
}
