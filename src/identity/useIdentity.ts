import { useEffect } from "react";
import { useAuthState } from "../auth";
import { validateIdentity } from "./service";
import { useIdentityState } from "./state";

/** One-shot validation when auth flips to authenticated; clears on logout. */
export function useIdentity(): void {
  const status = useAuthState((s) => s.status);
  const acquiredAt = useAuthState((s) => s.acquiredAt);
  const liveChecked = useAuthState((s) => s.liveChecked);

  useEffect(() => {
    // Wait for the live CHECK_LOGIN before firing — otherwise the persisted
    // "authenticated" state hydrates first and we hit Banner with stale
    // assumptions before the SW has confirmed cookies are still valid.
    if (!liveChecked) return;
    if (status === "authenticated") {
      void validateIdentity();
    } else {
      useIdentityState.getState().reset();
    }
  }, [status, acquiredAt, liveChecked]);
}
