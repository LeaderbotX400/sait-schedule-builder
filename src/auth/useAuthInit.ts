import { useEffect } from "react";
import { getAuthService } from "./service";
import { useAuthState } from "./state";

/** Periodic CHECK_LOGIN — catches server-side expiry without waiting on a Banner request. */
const POLL_INTERVAL_MS = 60 * 1000;
/** Bumps state.tick so age-derived selectors re-render. */
const AGE_TICK_INTERVAL_MS = 10 * 1000;

/** Mount once at the top of <App />. Hydrates auth state and starts the background tickers. */
export function useAuthInit(): void {
  useEffect(() => {
    const service = getAuthService();
    void service.init();

    const pollId = setInterval(() => {
      void service.refresh();
    }, POLL_INTERVAL_MS);

    const tickId = setInterval(() => {
      useAuthState.getState().bumpTick();
    }, AGE_TICK_INTERVAL_MS);

    const onVisibility = () => {
      if (document.visibilityState === "visible") void service.refresh();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      clearInterval(pollId);
      clearInterval(tickId);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);
}
