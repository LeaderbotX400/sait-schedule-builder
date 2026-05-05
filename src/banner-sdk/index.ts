// Public SDK barrel.

export type { GeneralClient } from "./apps/general";
export type { LoginValidation } from "./apps/general/identity";
export type { RegistrationClient } from "./apps/registration";
export type { SelfServiceClient } from "./apps/selfService";
export { type BannerHostConfig, DEFAULT_HOSTS } from "./config/hosts";
export { type BannerSdk, type BannerSdkOptions, createBannerSdk } from "./facade";
export { DirectTransport } from "./transport/direct";
export {
  BannerAuthRequiredError,
  BannerCsrfError,
  BannerError,
  BannerHttpError,
  BannerNetworkError,
  BannerNotPermittedError,
  BannerSessionExpiredError,
  BannerValidationError,
  isBannerError,
} from "./transport/errors";
export { ExtensionTransport } from "./transport/extension";
export { MockTransport, type RecordedCall } from "./transport/mock";
export type {
  BannerCredentials,
  BannerRequestInit,
  BannerTransport,
  RawResponse,
} from "./transport/types";
