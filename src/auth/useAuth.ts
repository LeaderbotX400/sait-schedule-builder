import { useCallback } from "react";
import { getAuthService } from "./service";
import { selectIsStale, selectSessionAgeSeconds, useAuthState } from "./state";
import type { AuthStatus, LoginResult } from "./types";

export interface UseAuthApi {
  status: AuthStatus;
  busy: boolean;
  error: string | null;
  sessionAgeSeconds: number;
  isStale: boolean;
  login: () => Promise<LoginResult>;
  reauth: () => Promise<LoginResult>;
  cancelLogin: () => void;
  disconnect: () => Promise<void>;
}

export function useAuth(): UseAuthApi {
  const status = useAuthState((s) => s.status);
  const busy = useAuthState((s) => s.busy);
  const error = useAuthState((s) => s.lastError);
  const sessionAgeSeconds = useAuthState(selectSessionAgeSeconds);
  const isStale = useAuthState(selectIsStale);

  const login = useCallback(() => getAuthService().login(), []);
  const reauth = useCallback(() => getAuthService().reauth(), []);
  const cancelLogin = useCallback(() => getAuthService().cancelLogin(), []);
  const disconnect = useCallback(() => getAuthService().disconnect(), []);

  return {
    status,
    busy,
    error,
    sessionAgeSeconds,
    isStale,
    login,
    reauth,
    cancelLogin,
    disconnect,
  };
}
