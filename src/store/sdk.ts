import { type BannerSdk, createBannerSdk, ExtensionTransport } from "../banner-sdk";
import { isDemoMode } from "../demo";
import { createDemoTransport } from "../demo/mockBanner";

let _sdk: BannerSdk | null = null;

/**
 * Module-level singleton SDK. Constructed lazily on first use so test code
 * that doesn't touch the store doesn't pull the chrome extension transport.
 *
 * One instance per page load — letting the SDK's session cache term-priming
 * state across the whole app. Components don't construct the SDK themselves;
 * they call store actions which go through this getter.
 *
 * In demo mode (`?demo=1`), the SDK is built on a `MockTransport`
 * pre-loaded with realistic Banner fixtures (see src/demo/mockBanner.ts).
 */
export function getSdk(): BannerSdk {
  if (!_sdk) {
    const transport = isDemoMode() ? createDemoTransport() : new ExtensionTransport();
    _sdk = createBannerSdk(transport);
  }
  return _sdk;
}

/** Test hook: replace the singleton with a different SDK (e.g. one that uses MockTransport). */
export function _setSdkForTesting(sdk: BannerSdk | null): void {
  _sdk = sdk;
}
