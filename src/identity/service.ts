import { getSdk } from "../auth";
import { createLogger } from "../lib/logger";
import { useIdentityState } from "./state";

const log = createLogger("identity");

/** Validate the Banner session, populate `studentId`. Returns the id on success. */
export async function validateIdentity(): Promise<string | null> {
  const state = useIdentityState.getState();
  state.setBusy(true);
  state.setError(null);
  log.info("validating identity");
  try {
    const sdk = getSdk();
    // Hit ssag2 (identity) and ssag1 (selfService prime) in parallel — different
    // hosts and JSESSIONIDs, both warm up as soon as auth flips. Prime failure is
    // tolerated; downstream selfService XHRs will retry priming on first call.
    const [result] = await Promise.all([
      sdk.general.identity.validateLogin(),
      sdk.selfService.prime().catch((err) => {
        log.warn(
          `parallel prime failed (will retry on first XHR) — ${err instanceof Error ? err.message : String(err)}`,
        );
      }),
    ]);
    if (result.valid) {
      log.info(`identity validated — studentId=${result.studentId}`);
      state.setStudentId(result.studentId);
      return result.studentId;
    }
    log.warn(`identity validation rejected (${result.reason}) — ${result.error}`);
    state.setStudentId(null);
    state.setError(result.error);
    return null;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    log.error(`identity validation threw — ${message}`, e);
    state.setStudentId(null);
    state.setError(message);
    return null;
  } finally {
    state.setBusy(false);
  }
}
