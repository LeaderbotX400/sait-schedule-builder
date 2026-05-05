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

export function getSdk(): BannerSdk {
  if (!_sdk) {
    const transport = isDemoMode() ? createDemoTransport() : new ExtensionTransport();
    _sdk = createBannerSdk(transport);
    _wrapped = wrapWithSessionGuard(_sdk);
  }
  return _wrapped as BannerSdk;
}

export function _setSdkForTesting(sdk: BannerSdk | null): void {
  _sdk = sdk;
  _wrapped = sdk ? wrapWithSessionGuard(sdk) : null;
}

function onSessionExpired(): void {
  useStore.getState().setLoggedIn(false);
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
