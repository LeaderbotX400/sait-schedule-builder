import { openBridgePort, sendBridgeMessage } from "@/lib/bridge/client";
import type { LoginPortName, LoginPortResult } from "@/lib/bridge/protocol";
import { isExtensionContext } from "@/lib/extensionId";
import type { CredentialStore } from "./credentialStore";
import type { CredentialState, LoginResult } from "./types";

const PERSIST_KEY = "sait-auth-v1";
const SOURCE = "extension-cookies";

function chromeRuntimeAvailable(): boolean {
  return typeof chrome !== "undefined" && !!chrome.runtime;
}

interface PersistedShape {
  status: "authenticated" | "unauthenticated";
  acquiredAt: number | null;
}

function readLocal(): PersistedShape | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(PERSIST_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedShape>;
    if (parsed.status !== "authenticated" && parsed.status !== "unauthenticated") return null;
    return {
      status: parsed.status,
      acquiredAt: typeof parsed.acquiredAt === "number" ? parsed.acquiredAt : null,
    };
  } catch {
    return null;
  }
}

function writeLocal(state: PersistedShape | null): void {
  if (typeof localStorage === "undefined") return;
  try {
    if (state == null) localStorage.removeItem(PERSIST_KEY);
    else localStorage.setItem(PERSIST_KEY, JSON.stringify(state));
  } catch {
    /* quota / private mode — silent */
  }
}

/**
 * Default credential store: round-trips through the chrome extension's
 * service worker, which has host_permissions on the Banner subdomains
 * and can read the SAIT JSESSIONID + NLB cookies the popup login mints.
 * Works from both the extension page itself and from
 * localhost / pages.dev via the externally_connectable manifest entry.
 */
export class ExtensionCookieCredentialStore implements CredentialStore {
  readonly source = SOURCE;
  private listeners = new Set<(s: CredentialState) => void>();
  private chromeListenerInstalled = false;
  private activeLoginPort: chrome.runtime.Port | null = null;

  readPersisted(): CredentialState | null {
    const p = readLocal();
    if (!p) return null;
    return { status: p.status, acquiredAt: p.acquiredAt, source: SOURCE };
  }

  async getState(): Promise<CredentialState> {
    if (!chromeRuntimeAvailable()) {
      return { status: "unauthenticated", acquiredAt: null, source: SOURCE };
    }
    const res = await sendBridgeMessage<"CHECK_LOGIN">({ type: "CHECK_LOGIN" });
    const loggedIn = "loggedIn" in res && !!res.loggedIn;

    const persisted = readLocal();
    if (loggedIn) {
      const acquiredAt = persisted?.status === "authenticated" ? persisted.acquiredAt : Date.now();
      writeLocal({ status: "authenticated", acquiredAt });
      return { status: "authenticated", acquiredAt, source: SOURCE };
    }
    writeLocal({ status: "unauthenticated", acquiredAt: null });
    return { status: "unauthenticated", acquiredAt: null, source: SOURCE };
  }

  subscribe(fn: (s: CredentialState) => void): () => void {
    this.listeners.add(fn);
    this.installChromeListener();
    return () => {
      this.listeners.delete(fn);
    };
  }

  /**
   * Only useful when the app runs as the extension's own page — chrome
   * `onMessage` doesn't deliver to externally-connected pages. For
   * localhost/pages.dev the listener is a no-op; live updates flow
   * through the login port and the periodic `refresh()` tick instead.
   */
  private installChromeListener(): void {
    if (this.chromeListenerInstalled) return;
    if (!chromeRuntimeAvailable()) return;
    if (!isExtensionContext()) {
      this.chromeListenerInstalled = true;
      return;
    }
    this.chromeListenerInstalled = true;
    chrome.runtime.onMessage.addListener(
      (msg: { type?: string; loggedIn?: boolean } | undefined) => {
        if (!msg || msg.type !== "LOGIN_STATE_CHANGED") return;
        const status = msg.loggedIn ? "authenticated" : "unauthenticated";
        const acquiredAt = status === "authenticated" ? Date.now() : null;
        writeLocal({ status, acquiredAt });
        for (const fn of this.listeners) {
          fn({ status, acquiredAt, source: SOURCE });
        }
      },
    );
  }

  startLogin(opts?: { force?: boolean }): Promise<LoginResult> {
    if (!chromeRuntimeAvailable()) {
      return Promise.resolve({
        ok: false,
        error: "NO_EXTENSION",
        message: "Browser extension is not available.",
      });
    }
    const portName: LoginPortName = opts?.force ? "force-reauth" : "login";
    return new Promise<LoginResult>((resolve) => {
      let port: chrome.runtime.Port | null;
      try {
        port = openBridgePort(portName);
      } catch (e) {
        resolve({
          ok: false,
          error: "PORT_FAILED",
          message: e instanceof Error ? e.message : "Could not open extension port",
        });
        return;
      }
      if (!port) {
        resolve({
          ok: false,
          error: "NO_EXTENSION_ID",
          message:
            "Extension ID is not set. Install the SAIT Schedule Builder extension or paste its ID in settings.",
        });
        return;
      }

      this.activeLoginPort = port;
      let resolved = false;
      const finish = (result: LoginResult) => {
        if (resolved) return;
        resolved = true;
        if (this.activeLoginPort === port) this.activeLoginPort = null;
        if (result.ok) {
          const acquiredAt = Date.now();
          writeLocal({ status: "authenticated", acquiredAt });
          for (const fn of this.listeners) {
            fn({ status: "authenticated", acquiredAt, source: SOURCE });
          }
        }
        resolve(result);
      };

      port.onMessage.addListener((msg: LoginPortResult) => {
        if (msg.ok) finish({ ok: true });
        else
          finish({
            ok: false,
            error: msg.error || "LOGIN_FAILED",
            message: msg.message || "Login failed. Please try again.",
          });
      });
      port.onDisconnect.addListener(() => {
        const err = chrome.runtime.lastError;
        finish({
          ok: false,
          error: "DISCONNECTED",
          message: err?.message ?? "Extension disconnected before login completed.",
        });
      });
    });
  }

  cancelLogin(): void {
    const port = this.activeLoginPort;
    if (!port) return;
    this.activeLoginPort = null;
    try {
      port.disconnect();
    } catch {
      /* already disconnected */
    }
  }

  async clear(): Promise<void> {
    writeLocal(null);
    for (const fn of this.listeners) {
      fn({ status: "unauthenticated", acquiredAt: null, source: SOURCE });
    }
    if (!chromeRuntimeAvailable()) return;
    await sendBridgeMessage<"CLEAR_SESSION">({ type: "CLEAR_SESSION" });
  }
}
