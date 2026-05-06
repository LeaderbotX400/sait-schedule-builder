import { getSdk } from "../auth";
import { useHoldsState } from "./state";

export async function loadHolds(studentId: string): Promise<void> {
  const state = useHoldsState.getState();
  state.setBusy(true);
  state.setError(null);
  try {
    const res = await getSdk().selfService.holds.getHoldsCount(studentId);
    state.setCount(typeof res?.count === "number" ? res.count : null);
  } catch (e) {
    state.setError(e instanceof Error ? e.message : String(e));
  } finally {
    state.setBusy(false);
  }
}
