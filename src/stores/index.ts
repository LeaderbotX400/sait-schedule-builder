/**
 * Public barrel for every Pinia store + persistence installers. Call
 * `installStorePersistence()` once from main.ts after `app.use(pinia)`
 * so every store hydrates before the first component reads it.
 */

export { useCoursesStore } from "./courses";
export { useCurrentRegStore, persistCurrentRegStore } from "./currentReg";
export { useRulesStore, persistRulesStore } from "./rules";
export {
  type GenerationStatus,
  useSchedulesStore,
} from "./schedules";
export { useSelectionStore, persistSelectionStore } from "./selection";
export { useTermStore, persistTermStore } from "./term";
export { useUiStore } from "./ui";

import { persistCurrentRegStore } from "./currentReg";
import { persistRulesStore } from "./rules";
import { persistSelectionStore } from "./selection";
import { persistTermStore } from "./term";

/** Install persistence for every persisted store. */
export function installStorePersistence(): void {
  persistRulesStore();
  persistTermStore();
  persistSelectionStore();
  persistCurrentRegStore();
}
