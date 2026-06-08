/**
 * Resolves the chrome extension ID for the SAIT Schedule Builder.
 *
 * When the app runs as the extension's own page (chrome-extension://...),
 * the extension ID is implicit and `chrome.runtime.sendMessage(msg, cb)`
 * targets the same extension. When the app runs from localhost or
 * pages.dev (the "web" context), every cross-extension message must
 * include the target extension ID.
 *
 * Resolution order (first match wins):
 *   1. localStorage["sait-sb-ext-id"]      — user-provided override
 *   2. EXT_ID broadcast captured at boot   — auto-detected
 *   3. import.meta.env.VITE_EXT_ID         — build-time default
 */

const STORAGE_KEY = "sait-sb-ext-id";

let detected: string | null = null;
const listeners = new Set<(id: string | null) => void>();

function readOverride(): string | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v && v.length > 0 ? v : null;
  } catch {
    return null;
  }
}

function readEnv(): string | null {
  const v = import.meta.env.VITE_EXT_ID;
  return typeof v === "string" && v.length > 0 ? v : null;
}

export function isExtensionContext(): boolean {
  return (
    typeof chrome !== "undefined" &&
    !!chrome.runtime &&
    typeof chrome.runtime.id === "string" &&
    chrome.runtime.id.length > 0
  );
}

export function getExtensionId(): string | null {
  if (isExtensionContext()) return chrome.runtime.id;
  return readOverride() ?? detected ?? readEnv();
}

export function setExtensionId(id: string | null): void {
  if (typeof localStorage === "undefined") return;
  try {
    if (id == null || id.length === 0) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* quota / private mode — ignore */
  }
  notify();
}

export function recordDetectedExtensionId(id: string): void {
  if (!id || detected === id) return;
  detected = id;
  notify();
}

export function subscribeExtensionId(fn: (id: string | null) => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

function notify(): void {
  const next = getExtensionId();
  for (const fn of listeners) fn(next);
}
