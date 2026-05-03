import { type BannerSdk, createBannerSdk, ExtensionTransport } from "../banner-sdk";

let _sdk: BannerSdk | null = null;

/**
 * Module-level singleton SDK. Constructed lazily on first use so test code
 * that doesn't touch the store doesn't pull the chrome extension transport.
 *
 * One instance per page load — letting the SDK's session cache term-priming
 * state across the whole app. Components don't construct the SDK themselves;
 * they call store actions which go through this getter.
 */
export function getSdk(): BannerSdk {
  if (!_sdk) {
    _sdk = createBannerSdk(new ExtensionTransport());
  }
  return _sdk;
}

/** Test hook: replace the singleton with a different SDK (e.g. one that uses MockTransport). */
export function _setSdkForTesting(sdk: BannerSdk | null): void {
  _sdk = sdk;
}
