import { useEffect } from "react";
import { useAuthState } from "../auth";
import { validateIdentity } from "./service";
import { useIdentityState } from "./state";

/** One-shot validation when auth flips to authenticated; clears on logout. */
export function useIdentity(): void {
  const status = useAuthState((s) => s.status);
  const acquiredAt = useAuthState((s) => s.acquiredAt);

  useEffect(() => {
    if (status === "authenticated") {
      void validateIdentity();
    } else {
      useIdentityState.getState().reset();
    }
  }, [status, acquiredAt]);
}
