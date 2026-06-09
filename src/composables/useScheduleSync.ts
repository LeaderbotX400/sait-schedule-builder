import { storeToRefs } from "pinia";
import { onUnmounted, watch } from "vue";
import { useAuthStore } from "@/features/auth/store";
import { BannerAuthRequiredError } from "../banner-sdk";
import { parseActiveRegistrations } from "../domain/parser";
import type { CourseSection } from "../domain/types";
import { getSdk } from "../lib/sdk";
import { mergeTermOptions } from "../lib/terms";
import { useCoursesStore } from "../stores/courses";
import { useCurrentRegStore } from "../stores/currentReg";
import { useRulesStore } from "../stores/rules";
import { useSchedulesStore } from "../stores/schedules";
import { useSelectionStore } from "../stores/selection";
import { useTermStore } from "../stores/term";
import { useUiStore } from "../stores/ui";

/** Drop these Banner term flavours from the picker — they can't be planned against. */
const SKIP_TERMS = ["(View Only)", "(View only)", "Non-Credit", "Apprentice"];

/** Debounce window for auto-regenerate when selection / rules change. */
const REGEN_DEBOUNCE_MS = 200;
/** Banner's term-prime occasionally responds before student data is ready; one retry usually fixes it. */
const FETCH_RETRY_MS = 1500;

function plannableTerms<T extends { description: string }>(terms: T[]): T[] {
  return terms.filter((t) => !SKIP_TERMS.some((skip) => t.description.includes(skip)));
}

/**
 * Outcome of a single Banner snapshot pull. Returned by
 * [[fetchBannerSnapshot]] without mutating any per-term store, so the
 * caller can decide whether to apply the result (or discard it if a
 * later request superseded this one).
 */
type SnapshotOutcome =
  | { kind: "loaded"; termCode: string; groups: Map<string, CourseSection[]> }
  | { kind: "term-switched"; newTerm: string }
  | { kind: "no-targets" }
  | { kind: "no-registrations"; termCode: string };

/**
 * Pull terms + registrations from Banner. The terms picker IS updated
 * here (idempotent + harmless even if the caller bails afterwards);
 * everything else is returned as data for the caller to apply.
 */
async function fetchBannerSnapshot(currentTerm: string): Promise<SnapshotOutcome> {
  const sdk = getSdk();
  const banner = await sdk.registration.terms.list();
  if (banner.length === 0) {
    throw new Error("Banner returned no terms — session may be invalid");
  }

  const plannable = plannableTerms(banner);
  useTermStore().setTermOptions(mergeTermOptions(plannable));

  const currentIsPlannable = plannable.some((t) => t.code === currentTerm);
  const targetCode = currentIsPlannable ? currentTerm : plannable[0]?.code;
  if (!targetCode) return { kind: "no-targets" };
  if (targetCode !== currentTerm) {
    // setTerm cascades a wipe across every per-term store and re-fires
    // the watcher — bail and let the new run pick up the registrations.
    useTermStore().setTerm(targetCode);
    return { kind: "term-switched", newTerm: targetCode };
  }

  const registrations = await sdk.registration.registrations.listActive(targetCode);
  const groups = parseActiveRegistrations(registrations, targetCode);
  if (groups.size === 0) return { kind: "no-registrations", termCode: targetCode };
  return { kind: "loaded", termCode: targetCode, groups };
}

/** Apply a loaded snapshot to every per-term store. Pure side effects. */
function applyLoadedSnapshot(groups: Map<string, CourseSection[]>): void {
  useCoursesStore().setCourseGroups(groups);
  useSelectionStore().setSelectedCourses((prev) => {
    const restored = new Set([...prev].filter((name) => groups.has(name)));
    return restored.size > 0 ? restored : new Set(groups.keys());
  });
  useCurrentRegStore().initializeFromGroups(groups);
}

/** Translate a thrown error into a user-facing string + auth-required flip. */
function reportError(err: unknown, prefix: string): void {
  const uiStore = useUiStore();
  if (err instanceof BannerAuthRequiredError) {
    uiStore.setLoadError(err.message);
    uiStore.setAuthRequired(true);
    return;
  }
  const msg = err instanceof Error ? err.message : String(err);
  uiStore.setLoadError(`${prefix}: ${msg}. Try reconnecting to Banner.`);
}

/**
 * Background data sync. Mount once at the root of App.vue. Watches
 * `auth.liveChecked + auth.status` and the active term, and on every
 * change pulls a fresh list of plannable terms + active registrations
 * from Banner. Also debounces a re-generate whenever the planner
 * inputs (selection / rules / courses) change.
 */
export function useScheduleSync(): void {
  const auth = useAuthStore();
  const { status: authStatus, liveChecked } = storeToRefs(auth);

  const { term } = storeToRefs(useTermStore());
  const { courseGroups } = storeToRefs(useCoursesStore());
  const { selectedCourses } = storeToRefs(useSelectionStore());
  const { rules } = storeToRefs(useRulesStore());

  const schedulesStore = useSchedulesStore();
  const uiStore = useUiStore();

  // Cancellation token — incremented to discard stale in-flight results.
  let runId = 0;

  async function fetchRegistrations(isRetry: boolean): Promise<void> {
    const myRunId = ++runId;
    uiStore.setRegistrationsLoading(true);
    if (!isRetry) uiStore.setLoadError(null);

    try {
      const outcome = await fetchBannerSnapshot(term.value);
      if (myRunId !== runId) return;

      if (outcome.kind === "loaded") {
        applyLoadedSnapshot(outcome.groups);
        return;
      }
      // term-switched: setTerm already fired the watcher again — bail.
      // no-targets: nothing actionable, leave the UI as-is.
      // no-registrations: Banner sometimes lags; retry once.
      if (outcome.kind === "no-registrations" && !isRetry) {
        setTimeout(() => void fetchRegistrations(true), FETCH_RETRY_MS);
      }
    } catch (err) {
      if (myRunId !== runId) return;
      if (err instanceof BannerAuthRequiredError) {
        reportError(err, "");
        return;
      }
      if (!isRetry) {
        setTimeout(() => void fetchRegistrations(true), FETCH_RETRY_MS);
        return;
      }
      reportError(err, "Could not load your registrations");
    } finally {
      if (myRunId === runId) uiStore.setRegistrationsLoading(false);
    }
  }

  const stopFetchWatch = watch(
    [authStatus, liveChecked, term],
    ([status, checked]) => {
      if (!checked) return;
      if (status !== "authenticated") return;
      void fetchRegistrations(false);
    },
    { immediate: true },
  );

  // Debounced auto-regenerate. Touches every input the scheduler reads
  // so any change re-runs the (cheap) generation step.
  let regenTimer: ReturnType<typeof setTimeout> | null = null;
  const stopRegenWatch = watch(
    [courseGroups, selectedCourses, rules],
    ([groups, selection]) => {
      if (groups.size === 0 || selection.size === 0) return;
      if (regenTimer != null) clearTimeout(regenTimer);
      regenTimer = setTimeout(() => schedulesStore.generate(), REGEN_DEBOUNCE_MS);
    },
    { deep: true },
  );

  onUnmounted(() => {
    runId++;
    stopFetchWatch();
    stopRegenWatch();
    if (regenTimer != null) clearTimeout(regenTimer);
  });
}

/**
 * Imperative one-shot refresh. Hook into manual "Refresh" buttons.
 * Same core as the watcher path but without retry or cancellation —
 * the user explicitly asked for fresh data; surface errors directly.
 */
export async function refreshAllData(): Promise<void> {
  const auth = useAuthStore();
  if (auth.status !== "authenticated") return;

  const uiStore = useUiStore();
  uiStore.setRegistrationsLoading(true);
  uiStore.setLoadError(null);

  try {
    const outcome = await fetchBannerSnapshot(useTermStore().term);
    if (outcome.kind === "loaded") applyLoadedSnapshot(outcome.groups);
  } catch (err) {
    reportError(err, "Could not refresh your registrations");
  } finally {
    uiStore.setRegistrationsLoading(false);
  }
}
