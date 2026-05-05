import {
  type BannerSdk,
  BannerSessionExpiredError,
  createBannerSdk,
  ExtensionTransport,
} from "../banner-sdk";
import { isDemoMode } from "../demo";
import { createDemoTransport } from "../demo/mockBanner";
import { useStore } from "./index";

let _sdk: BannerSdk | null = null;
let _wrapped: BannerSdk | null = null;

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
 *
 * The returned SDK is wrapped in a recursive Proxy that catches
 * `BannerSessionExpiredError` from any method call (including nested
 * namespaces like `sdk.registration.cart.stage`) and dispatches
 * `markSessionExpired()` on the store. This is what triggers the
 * existing reauth-popup effect in `useAuth.ts`.
 */
export function getSdk(): BannerSdk {
  if (!_sdk) {
    const transport = isDemoMode() ? createDemoTransport() : new ExtensionTransport();
    _sdk = createBannerSdk(transport);
    _wrapped = wrapWithSessionGuard(_sdk);
  }
  return _wrapped as BannerSdk;
}

/** Test hook: replace the singleton with a different SDK (e.g. one that uses MockTransport). */
export function _setSdkForTesting(sdk: BannerSdk | null): void {
  _sdk = sdk;
  _wrapped = sdk ? wrapWithSessionGuard(sdk) : null;
}

function onSessionExpired(): void {
  // Fetched lazily so the wrapper survives module-eval order quirks; this
  // only fires when an SDK call has actually thrown, long after init.
  useStore.getState().markSessionExpired();
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
                if (e instanceof BannerSessionExpiredError) onSessionExpired();
                throw e;
              });
            }
            return out;
          } catch (e) {
            if (e instanceof BannerSessionExpiredError) onSessionExpired();
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
