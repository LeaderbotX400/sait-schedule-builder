/** Public barrel for the auth module. */

export type { CredentialStore } from "./credentialStore";
export { AuthService, _setAuthServiceForTesting, getAuthService } from "./service";
export { useAuthStore } from "./store";
export { AUTH_STALE_AFTER_MS } from "./types";
export type { AuthStatus, CredentialState, LoginResult } from "./types";
export { type UseAuthApi, useAuth } from "./useAuth";
export { useAuthInit } from "./useAuthInit";
