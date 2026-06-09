import type { createLogger } from "../../../lib/logger";

type Logger = ReturnType<typeof createLogger>;

/**
 * selfService data endpoints degrade gracefully: any failure is logged and
 * surfaced as `null` so a missing GPA/holds payload never breaks callers.
 */
export async function withNullFallback<T>(
  log: Logger,
  label: string,
  fn: () => Promise<T>,
): Promise<T | null> {
  try {
    return await fn();
  } catch (err) {
    log.warn(
      `${label} failed — ${err instanceof Error ? `${err.name}: ${err.message}` : String(err)}`,
    );
    return null;
  }
}
