import { storeToRefs } from "pinia";
import type { ComputedRef, Ref } from "vue";
import { getAuthService } from "./service";
import { useAuthStore } from "./store";
import type { AuthStatus, LoginResult } from "./types";

export interface UseAuthApi {
  status: Ref<AuthStatus>;
  busy: Ref<boolean>;
  error: Ref<string | null>;
  sessionAgeSeconds: ComputedRef<number>;
  isStale: ComputedRef<boolean>;
  login: () => Promise<LoginResult>;
  reauth: () => Promise<LoginResult>;
  cancelLogin: () => void;
  disconnect: () => Promise<void>;
}

/**
 * Component-facing auth API. Returns reactive refs from the auth
 * store plus the action callbacks bound to the singleton service.
 *
 * Prefer this over reading the store directly in components — it
 * pre-computes the right ref types and hides the service singleton
 * behind a stable surface.
 */
export function useAuth(): UseAuthApi {
  const store = useAuthStore();
  const { status, busy, lastError, sessionAgeSeconds, isStale } = storeToRefs(store);

  const service = getAuthService();

  return {
    status,
    busy,
    error: lastError,
    sessionAgeSeconds,
    isStale,
    login: () => service.login(),
    reauth: () => service.reauth(),
    cancelLogin: () => service.cancelLogin(),
    disconnect: () => service.disconnect(),
  };
}
