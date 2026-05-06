import type { CredentialStore } from "./credentialStore";
import type { CredentialState, LoginResult } from "./types";

const PERSIST_KEY = "sait-auth-v1";
const SOURCE = "extension-cookies";

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
    /* quota / private mode — ignore */
  }
}

export class ExtensionCookieCredentialStore implements CredentialStore {
  readonly source = SOURCE;
  private listeners = new Set<(s: CredentialState) => void>();
  private chromeListenerInstalled = false;

  readPersisted(): CredentialState | null {
    const p = readLocal();
    if (!p) return null;
    return { status: p.status, acquiredAt: p.acquiredAt, source: SOURCE };
  }

  async getState(): Promise<CredentialState> {
    if (typeof chrome === "undefined" || !chrome.runtime) {
      return { status: "unauthenticated", acquiredAt: null, source: SOURCE };
    }
    const loggedIn = await new Promise<boolean>((resolve) => {
      chrome.runtime.sendMessage(
        { type: "CHECK_LOGIN" },
        (res: { loggedIn?: boolean } | undefined) => {
          if (chrome.runtime.lastError) {
            resolve(false);
            return;
          }
          resolve(!!res?.loggedIn);
        },
      );
    });

    const persisted = readLocal();
    if (loggedIn) {
      const acquiredAt = persisted?.status === "authenticated" ? persisted.acquiredAt : Date.now();
      const next: CredentialState = { status: "authenticated", acquiredAt, source: SOURCE };
      writeLocal({ status: "authenticated", acquiredAt });
      return next;
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

  private installChromeListener(): void {
    if (this.chromeListenerInstalled) return;
    if (typeof chrome === "undefined" || !chrome.runtime) return;
    this.chromeListenerInstalled = true;
    chrome.runtime.onMessage.addListener(
      (msg: { type?: string; loggedIn?: boolean } | undefined) => {
        if (!msg || msg.type !== "LOGIN_STATE_CHANGED") return;
        const status = msg.loggedIn ? "authenticated" : "unauthenticated";
        const acquiredAt = status === "authenticated" ? Date.now() : null;
        const next: CredentialState = { status, acquiredAt, source: SOURCE };
        writeLocal({ status, acquiredAt });
        for (const fn of this.listeners) fn(next);
      },
    );
  }

  startLogin(opts?: { force?: boolean }): Promise<LoginResult> {
    if (typeof chrome === "undefined" || !chrome.runtime) {
      return Promise.resolve({
        ok: false,
        error: "NO_EXTENSION",
        message: "Browser extension is not available.",
      });
    }
    const portName = opts?.force ? "force-reauth" : "login";
    return new Promise<LoginResult>((resolve) => {
      let port: chrome.runtime.Port;
      try {
        port = chrome.runtime.connect({ name: portName });
      } catch (e) {
        resolve({
          ok: false,
          error: "PORT_FAILED",
          message: e instanceof Error ? e.message : "Could not open extension port",
        });
        return;
      }

      let resolved = false;
      const finish = (result: LoginResult) => {
        if (resolved) return;
        resolved = true;
        if (result.ok) {
          const acquiredAt = Date.now();
          writeLocal({ status: "authenticated", acquiredAt });
          for (const fn of this.listeners) {
            fn({ status: "authenticated", acquiredAt, source: SOURCE });
          }
        }
        resolve(result);
      };

      port.onMessage.addListener((msg: { ok?: boolean; error?: string; message?: string }) => {
        if (msg.ok) finish({ ok: true });
        else
          finish({
            ok: false,
            error: msg.error ?? "LOGIN_FAILED",
            message: msg.message ?? "Login failed. Please try again.",
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

  clear(): Promise<void> {
    writeLocal(null);
    for (const fn of this.listeners) {
      fn({ status: "unauthenticated", acquiredAt: null, source: SOURCE });
    }
    if (typeof chrome === "undefined" || !chrome.runtime) return Promise.resolve();
    return new Promise<void>((resolve) => {
      chrome.runtime.sendMessage({ type: "CLEAR_SESSION" }, () => {
        // Swallow lastError; the local state is already cleared.
        void chrome.runtime.lastError;
        resolve();
      });
    });
  }
}
