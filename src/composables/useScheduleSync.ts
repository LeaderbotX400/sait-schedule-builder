import { storeToRefs } from "pinia";
import { onUnmounted, watch } from "vue";
import { useAuthStore } from "../auth/store";
import { BannerAuthRequiredError } from "../banner-sdk";
import { parseActiveRegistrations } from "../domain/parser";
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
 * Background data sync. Mount once at the root of App.vue. Watches
 * `auth.liveChecked + auth.status` and the active term, and on every
 * change pulls a fresh list of plannable terms + active registrations
 * from Banner. Also debounces a re-generate whenever the planner
 * inputs (selection / rules / courses) change.
 *
 * Errors fall through to ui.loadError. BannerAuthRequiredError flips
 * ui.authRequired so the main area surfaces the reconnect button.
 */
export function useScheduleSync(): void {
  const auth = useAuthStore();
  const { status: authStatus, liveChecked } = storeToRefs(auth);

  const termStore = useTermStore();
  const { term } = storeToRefs(termStore);

  const coursesStore = useCoursesStore();
  const { courseGroups } = storeToRefs(coursesStore);

  const selectionStore = useSelectionStore();
  const { selectedCourses } = storeToRefs(selectionStore);

  const rulesStore = useRulesStore();
  const { rules } = storeToRefs(rulesStore);

  const currentRegStore = useCurrentRegStore();
  const schedulesStore = useSchedulesStore();
  const uiStore = useUiStore();

  // Cancellation handle for the currently-running fetch. A token instead
  // of an AbortController because we only need to discard the result —
  // the SDK calls themselves don't accept a signal yet.
  let runId = 0;

  async function fetchRegistrations(isRetry: boolean): Promise<void> {
    const myRunId = ++runId;
    uiStore.setRegistrationsLoading(true);
    if (!isRetry) uiStore.setLoadError(null);

    try {
      const sdk = getSdk();
      const banner = await sdk.registration.terms.list();
      if (myRunId !== runId) return;

      if (banner.length === 0) {
        throw new Error("Banner returned no terms — session may be invalid");
      }
      const plannable = plannableTerms(banner);
      termStore.setTermOptions(mergeTermOptions(plannable));

      // If the persisted term isn't plannable, switch to the newest one.
      // `setTerm` itself cascades a wipe — bail out and let the new term
      // trigger another sync run.
      const currentIsPlannable = plannable.some((t) => t.code === term.value);
      const targetCode = currentIsPlannable ? term.value : plannable[0]?.code;
      if (!targetCode) return;
      if (targetCode !== term.value) {
        termStore.setTerm(targetCode);
        return;
      }

      const registrations = await sdk.registration.registrations.listActive(targetCode);
      if (myRunId !== runId) return;

      const groups = parseActiveRegistrations(registrations, targetCode);
      if (groups.size > 0) {
        coursesStore.setCourseGroups(groups);
        selectionStore.setSelectedCourses((prev) => {
          const restored = new Set([...prev].filter((name) => groups.has(name)));
          return restored.size > 0 ? restored : new Set(groups.keys());
        });
        currentRegStore.initializeFromGroups(groups);
      } else if (!isRetry) {
        setTimeout(() => void fetchRegistrations(true), FETCH_RETRY_MS);
        return;
      }
    } catch (err) {
      if (myRunId !== runId) return;
      if (err instanceof BannerAuthRequiredError) {
        uiStore.setLoadError(err.message);
        uiStore.setAuthRequired(true);
        return;
      }
      if (!isRetry) {
        setTimeout(() => void fetchRegistrations(true), FETCH_RETRY_MS);
        return;
      }
      const msg = err instanceof Error ? err.message : String(err);
      uiStore.setLoadError(`Could not load your registrations: ${msg}. Try reconnecting to Banner.`);
    } finally {
      if (myRunId === runId) uiStore.setRegistrationsLoading(false);
    }
  }

  // Fetch trigger: any time we're freshly authenticated + verified-live, or the term changes.
  const stopFetchWatch = watch(
    [authStatus, liveChecked, term],
    ([status, checked]) => {
      if (!checked) return;
      if (status !== "authenticated") return;
      void fetchRegistrations(false);
    },
    { immediate: true },
  );

  // Debounced auto-regenerate. Touches every input the scheduler reads so
  // any change re-runs the (cheap) generation step.
  let regenTimer: ReturnType<typeof setTimeout> | null = null;
  const stopRegenWatch = watch(
    [courseGroups, selectedCourses, rules],
    ([groups, selection]) => {
      if (groups.size === 0 || selection.size === 0) return;
      if (regenTimer != null) clearTimeout(regenTimer);
      regenTimer = setTimeout(() => schedulesStore.generate(), REGEN_DEBOUNCE_MS);
    },
    // `rules` is a structured object; watch deeply so nested edits trigger.
    { deep: true },
  );

  onUnmounted(() => {
    runId++; // discard any in-flight result
    stopFetchWatch();
    stopRegenWatch();
    if (regenTimer != null) clearTimeout(regenTimer);
  });
}

/**
 * Imperative one-shot refresh. Hook into manual "Refresh" buttons.
 * Same logic as the watcher path; bypasses the debounce.
 */
export async function refreshAllData(): Promise<void> {
  const auth = useAuthStore();
  if (auth.status !== "authenticated") return;

  const termStore = useTermStore();
  const coursesStore = useCoursesStore();
  const selectionStore = useSelectionStore();
  const currentRegStore = useCurrentRegStore();
  const uiStore = useUiStore();

  uiStore.setRegistrationsLoading(true);
  uiStore.setLoadError(null);

  try {
    const sdk = getSdk();
    const terms = await sdk.registration.terms.list();
    if (terms.length === 0) {
      throw new Error("Banner returned no terms — session may be invalid");
    }
    const plannable = plannableTerms(terms);
    termStore.setTermOptions(mergeTermOptions(plannable));

    const currentIsPlannable = plannable.some((t) => t.code === termStore.term);
    const targetCode = currentIsPlannable ? termStore.term : plannable[0]?.code;
    if (!targetCode) return;
    if (targetCode !== termStore.term) termStore.setTerm(targetCode);

    const registrations = await sdk.registration.registrations.listActive(targetCode);
    if (registrations.length > 0) {
      const groups = parseActiveRegistrations(registrations, targetCode);
      coursesStore.setCourseGroups(groups);
      selectionStore.setSelectedCourses((prev) => {
        const restored = new Set([...prev].filter((name) => groups.has(name)));
        return restored.size > 0 ? restored : new Set(groups.keys());
      });
      currentRegStore.initializeFromGroups(groups);
    }
  } catch (err) {
    if (err instanceof BannerAuthRequiredError) {
      uiStore.setLoadError(err.message);
      uiStore.setAuthRequired(true);
      return;
    }
    const msg = err instanceof Error ? err.message : String(err);
    uiStore.setLoadError(`Could not refresh your registrations: ${msg}. Try reconnecting to Banner.`);
  } finally {
    uiStore.setRegistrationsLoading(false);
  }
}
