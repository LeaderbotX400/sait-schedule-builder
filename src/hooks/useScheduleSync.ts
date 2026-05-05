import { useEffect } from "react";
import { BannerAuthRequiredError } from "../banner-sdk";
import { parseActiveRegistrations } from "../domain/parser";
import { useStore } from "../store";
import { getSdk } from "../store/sdk";

const SKIP_TERMS = ["(View Only)", "Non-Credit", "Apprentice", "(View only)"];

/**
 * Cross-slice side effects that don't fit inside any single slice:
 *
 *   - When credentials are first set, fetch the term list, pick the
 *     student's active term, fetch their current registrations, and
 *     load them into the store.
 *   - When courseGroups / selectedCourses / rules change, debounce-
 *     regenerate schedules so the calendar reflects edits without
 *     requiring an explicit "Generate" click.
 *
 * Both effects retry the registration-load once on transient failure
 * (Banner sometimes returns no terms immediately after auth lands on
 * ssag6; the second attempt 1.5 s later usually succeeds).
 */
export function useScheduleSync(): void {
  const credentials = useStore((s) => s.credentials);
  const courseGroups = useStore((s) => s.courseGroups);
  const selectedCourses = useStore((s) => s.selectedCourses);
  const rules = useStore((s) => s.rules);
  const setCourseGroups = useStore((s) => s.setCourseGroups);
  const setSelectedCourses = useStore((s) => s.setSelectedCourses);
  const initializeCurrentRegistrations = useStore((s) => s.initializeCurrentRegistrations);
  const setTerm = useStore((s) => s.setTerm);
  const setLoadError = useStore((s) => s.setLoadError);
  const setAuthRequired = useStore((s) => s.setAuthRequired);
  const setRegistrationsLoading = useStore((s) => s.setRegistrationsLoading);
  const generate = useStore((s) => s.generate);

  // Auto-load registrations on connect.
  useEffect(() => {
    if (!credentials) return;
    let cancelled = false;

    const doFetch = async (isRetry: boolean): Promise<void> => {
      if (cancelled) return;
      setRegistrationsLoading(true);
      if (!isRetry) setLoadError(null);

      try {
        const sdk = getSdk();
        const terms = await sdk.registration.terms.list();
        if (cancelled) return;
        if (!terms.length) {
          throw new Error("Banner returned no terms — session may be invalid");
        }
        const activeTerm = terms.find((t) => !SKIP_TERMS.some((s) => t.description.includes(s)));
        const termCode = activeTerm?.code;
        if (!termCode) return;
        setTerm(termCode);

        const registrations = await sdk.registration.registrations.listActive(termCode);
        if (cancelled) return;

        if (registrations.length > 0) {
          const groups = parseActiveRegistrations(registrations);
          setCourseGroups(groups);
          setSelectedCourses((prev) => {
            const restored = new Set([...prev].filter((name) => groups.has(name)));
            return restored.size > 0 ? restored : new Set(groups.keys());
          });
          initializeCurrentRegistrations(groups);
        } else if (!isRetry) {
          setTimeout(() => void doFetch(true), 1500);
          return;
        }
      } catch (err) {
        if (cancelled) return;
        if (err instanceof BannerAuthRequiredError) {
          setLoadError(err.message);
          setAuthRequired(true);
          return;
        }
        if (!isRetry) {
          setTimeout(() => void doFetch(true), 1500);
          return;
        }
        const msg = err instanceof Error ? err.message : String(err);
        setLoadError(`Could not load your registrations: ${msg}. Try reconnecting to Banner.`);
      } finally {
        if (!cancelled) setRegistrationsLoading(false);
      }
    };

    void doFetch(false);
    return () => {
      cancelled = true;
    };
  }, [
    credentials,
    setCourseGroups,
    setSelectedCourses,
    initializeCurrentRegistrations,
    setTerm,
    setLoadError,
    setAuthRequired,
    setRegistrationsLoading,
  ]);

  // Debounced auto-regenerate when courses, selection, or rules change.
  // 200ms coalesces rapid changes (e.g. dragging the time-window slider).
  useEffect(() => {
    if (courseGroups.size === 0 || selectedCourses.size === 0) return;
    const timer = setTimeout(generate, 200);
    return () => clearTimeout(timer);
  }, [courseGroups, selectedCourses, rules, generate]);
}

/** Imperative refresh: re-fetches profile + terms + registrations. */
export async function refreshAllData(): Promise<void> {
  const state = useStore.getState();
  const { credentials, studentId } = state;
  if (!credentials || !studentId) return;

  state.setRegistrationsLoading(true);
  state.setLoadError(null);
  await state.refreshProfile();

  try {
    const sdk = getSdk();
    const terms = await sdk.registration.terms.list();
    if (!terms.length) {
      throw new Error("Banner returned no terms — session may be invalid");
    }
    const activeTerm = terms.find((t) => !SKIP_TERMS.some((s) => t.description.includes(s)));
    const termCode = activeTerm?.code;
    if (termCode) {
      state.setTerm(termCode);
      const registrations = await sdk.registration.registrations.listActive(termCode);
      if (registrations.length > 0) {
        const groups = parseActiveRegistrations(registrations);
        state.setCourseGroups(groups);
        state.setSelectedCourses((prev) => {
          const restored = new Set([...prev].filter((name) => groups.has(name)));
          return restored.size > 0 ? restored : new Set(groups.keys());
        });
        state.initializeCurrentRegistrations(groups);
      }
    }
  } catch (err) {
    if (err instanceof BannerAuthRequiredError) {
      state.setLoadError(err.message);
      state.setAuthRequired(true);
      return;
    }
    const msg = err instanceof Error ? err.message : String(err);
    state.setLoadError(`Could not refresh your registrations: ${msg}. Try reconnecting to Banner.`);
  } finally {
    state.setRegistrationsLoading(false);
  }
}
