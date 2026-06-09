// Public SDK barrel.

export type { GeneralClient, LoginValidation } from "./apps/general";
export type { RegistrationClient } from "./apps/registration";
export type { SelfServiceClient } from "./apps/selfService";
export { type BannerHostConfig, DEFAULT_HOSTS } from "./config/hosts";
export type { BannerSdkHooks } from "./core/request";
export { type BannerSdk, type BannerSdkOptions, createBannerSdk } from "./facade";
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
  BannerRequestInit,
  BannerTransport,
  RawResponse,
} from "./transport/types";
