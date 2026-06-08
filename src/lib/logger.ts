/**
 * Lightweight namespaced console logger.
 *
 * Per-namespace level overrides via localStorage:
 *   localStorage.setItem('sait-sb-log', 'debug')               // global
 *   localStorage.setItem('sait-sb-log:banner-sdk', 'debug')    // one namespace
 *
 * Default: 'info' in dev, 'warn' in prod. Tests stay at 'silent'.
 */

export type LogLevel = "debug" | "info" | "warn" | "error" | "silent";

const ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  silent: 99,
};

function envDefault(): LogLevel {
  // Vitest sets MODE=test; Vite sets DEV/PROD.
  // biome-ignore lint/suspicious/noExplicitAny: import.meta.env shape varies by build target
  const env = (import.meta as any)?.env ?? {};
  if (env.MODE === "test") return "silent";
  if (env.DEV) return "info";
  return "warn";
}

function readStored(key: string): LogLevel | null {
  try {
    if (typeof localStorage === "undefined") return null;
    const raw = localStorage.getItem(key);
    if (raw && raw in ORDER) return raw as LogLevel;
  } catch {
    // localStorage may throw in some contexts (sandboxed iframes, etc.)
  }
  return null;
}

function effectiveLevel(namespace: string): LogLevel {
  return readStored(`sait-sb-log:${namespace}`) ?? readStored("sait-sb-log") ?? envDefault();
}

export interface Logger {
  debug: (msg: unknown, ...rest: unknown[]) => void;
  info: (msg: unknown, ...rest: unknown[]) => void;
  warn: (msg: unknown, ...rest: unknown[]) => void;
  error: (msg: unknown, ...rest: unknown[]) => void;
}

const STYLES: Record<Exclude<LogLevel, "silent">, string> = {
  debug: "color:#888;font-weight:600",
  info: "color:#4a90e2;font-weight:600",
  warn: "color:#e2a04a;font-weight:600",
  error: "color:#e24a4a;font-weight:600",
};

function emit(level: Exclude<LogLevel, "silent">, namespace: string, args: unknown[]): void {
  if (ORDER[level] < ORDER[effectiveLevel(namespace)]) return;
  // %c only styles the prefix; subsequent args render normally.
  // biome-ignore lint/suspicious/noConsole: this module IS the logging primitive
  console[level](`%c[${namespace}]`, STYLES[level], ...args);
}

export function createLogger(namespace: string): Logger {
  return {
    debug: (...args) => emit("debug", namespace, args),
    info: (...args) => emit("info", namespace, args),
    warn: (...args) => emit("warn", namespace, args),
    error: (...args) => emit("error", namespace, args),
  };
}
