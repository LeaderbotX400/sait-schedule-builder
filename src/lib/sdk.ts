import { type BannerSdk, BannerSessionExpiredError, createBannerSdk, ExtensionTransport } from "../banner-sdk";

let _sdk: BannerSdk | null = null;
let _wrapped: BannerSdk | null = null;
let _onSessionExpired: (() => void) | null = null;

/**
 * Register a callback invoked whenever any SDK call throws
 * BannerSessionExpiredError. Call this once from the auth Pinia store
 * (or any other initializer) before the first getSdk() call.
 */
export function setSessionExpiredHandler(callback: () => void): void {
  _onSessionExpired = callback;
}

/** Returns the module-level SDK singleton, constructing it on first call. */
export function getSdk(): BannerSdk {
  if (!_sdk) {
    _sdk = createBannerSdk(new ExtensionTransport());
    _wrapped = wrapWithSessionGuard(_sdk);
  }
  return _wrapped as BannerSdk;
}

/**
 * Disconnect and drop the singleton — forces reconstruction on the next
 * getSdk() call. Use when credentials are cleared or the user signs out.
 */
export function resetSdk(): void {
  if (_sdk) {
    _sdk.disconnect();
    _sdk = null;
    _wrapped = null;
  }
}

/** For unit tests only — swap in a mock SDK without touching the real singleton. */
export function _setSdkForTesting(sdk: BannerSdk | null): void {
  _sdk = sdk;
  _wrapped = sdk ? wrapWithSessionGuard(sdk) : null;
}

function wrapWithSessionGuard<T extends object>(target: T): T {
  return new Proxy(target, {
    get(obj, prop, receiver) {
      const value = Reflect.get(obj, prop, receiver);
      if (typeof value === "function") {
        return (...args: unknown[]) => {
          try {
            const out = (value as (...a: unknown[]) => unknown).apply(obj, args);
            if (out instanceof Promise) {
              return out.catch((e: unknown) => {
                if (e instanceof BannerSessionExpiredError) _onSessionExpired?.();
                throw e;
              });
            }
            return out;
          } catch (e) {
            if (e instanceof BannerSessionExpiredError) _onSessionExpired?.();
            throw e;
          }
        };
      }
      if (value && typeof value === "object") {
        return wrapWithSessionGuard(value as object);
      }
      return value;
    },
  }) as T;
}
