import {
  type BannerError,
  type BannerSdk,
  createBannerSdk,
  ExtensionTransport,
} from "../banner-sdk";

let _sdk: BannerSdk | null = null;
let _onError: ((err: BannerError, url: string) => void) | null = null;

/**
 * Register a callback invoked whenever any SDK request fails with a
 * classified BannerError (via the SDK's `hooks.onError`). Call this once
 * from the auth service before the first getSdk() call — the handler can
 * be swapped at any time without rebuilding the SDK.
 */
export function setSdkErrorHandler(callback: (err: BannerError, url: string) => void): void {
  _onError = callback;
}

/** Returns the module-level SDK singleton, constructing it on first call. */
export function getSdk(): BannerSdk {
  if (!_sdk) {
    _sdk = createBannerSdk(new ExtensionTransport(), {
      hooks: { onError: (err, url) => _onError?.(err, url) },
    });
  }
  return _sdk;
}

/**
 * Disconnect and drop the singleton — forces reconstruction on the next
 * getSdk() call. Use when credentials are cleared or the user signs out.
 */
export function resetSdk(): void {
  if (_sdk) {
    _sdk.disconnect();
    _sdk = null;
  }
}

/** For unit tests only — swap in a mock SDK without touching the real singleton. */
export function _setSdkForTesting(sdk: BannerSdk | null): void {
  _sdk = sdk;
}
