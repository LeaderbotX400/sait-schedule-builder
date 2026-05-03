import { useCallback, useState } from "react";
import type { RegistrationBatchResult } from "../../banner-sdk/apps/registration/types";
import { getSdk } from "../../store/sdk";

export type RegisterState =
  | { kind: "idle" }
  | { kind: "confirming" }
  | { kind: "loading" }
  | { kind: "done"; result: RegistrationBatchResult };

export interface UseRegistrationReturn {
  state: RegisterState;
  begin: () => void;
  cancel: () => void;
  dismiss: () => void;
  register: (term: string, crns: string[]) => Promise<void>;
}

/**
 * Owns the four-state machine of the registration submit flow:
 *   idle → confirming → loading → done.
 *
 * Wraps `sdk.registration.registrations.registerCrns` so the component
 * doesn't reach into the SDK directly.
 */
export function useRegistration(): UseRegistrationReturn {
  const [state, setState] = useState<RegisterState>({ kind: "idle" });

  const begin = useCallback(() => setState({ kind: "confirming" }), []);
  const cancel = useCallback(() => setState({ kind: "idle" }), []);
  const dismiss = useCallback(() => setState({ kind: "idle" }), []);

  const register = useCallback(async (term: string, crns: string[]) => {
    setState({ kind: "loading" });
    const result = await getSdk().registration.registrations.registerCrns(term, crns);
    setState({ kind: "done", result });
  }, []);

  return { state, begin, cancel, dismiss, register };
}
