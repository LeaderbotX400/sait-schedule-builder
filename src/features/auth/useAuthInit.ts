import { onMounted, onUnmounted } from "vue";
import { getAuthService } from "./service";
import { useAuthStore } from "./store";

/** Periodic CHECK_LOGIN — catches server-side expiry without waiting on a Banner request. */
const POLL_INTERVAL_MS = 60 * 1000;
/** Bumps store.tick so age-derived `computed`s re-evaluate. */
const AGE_TICK_INTERVAL_MS = 10 * 1000;

/**
 * Mount once at the root component (App.vue). Hydrates auth state and
 * starts the background tickers (live-status poll, age clock, and
 * `visibilitychange` re-check).
 */
export function useAuthInit(): void {
  let pollId: ReturnType<typeof setInterval> | null = null;
  let tickId: ReturnType<typeof setInterval> | null = null;

  const onVisibility = (): void => {
    if (document.visibilityState === "visible") {
      void getAuthService().refresh();
    }
  };

  onMounted(() => {
    const service = getAuthService();
    void service.init();

    pollId = setInterval(() => {
      void service.refresh();
    }, POLL_INTERVAL_MS);

    tickId = setInterval(() => {
      useAuthStore().bumpTick();
    }, AGE_TICK_INTERVAL_MS);

    document.addEventListener("visibilitychange", onVisibility);
  });

  onUnmounted(() => {
    if (pollId != null) clearInterval(pollId);
    if (tickId != null) clearInterval(tickId);
    document.removeEventListener("visibilitychange", onVisibility);
  });
}
