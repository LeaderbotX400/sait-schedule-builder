import { useEffect } from "react";
import { getSdk, useAuthState } from "../auth";
import { BannerAuthRequiredError } from "../banner-sdk";
import { parseActiveRegistrations } from "../domain/parser";
import { useStore } from "../store";

const SKIP_TERMS = ["(View Only)", "Non-Credit", "Apprentice", "(View only)"];

export function useScheduleSync(): void {
  const isLoggedIn = useAuthState((s) => s.status === "authenticated");
  const liveChecked = useAuthState((s) => s.liveChecked);
  const term = useStore((s) => s.term);
  const courseGroups = useStore((s) => s.courseGroups);
  const selectedCourses = useStore((s) => s.selectedCourses);
  const setCourseGroups = useStore((s) => s.setCourseGroups);
  const setSelectedCourses = useStore((s) => s.setSelectedCourses);
  const initializeCurrentRegistrations = useStore((s) => s.initializeCurrentRegistrations);
  const setTerm = useStore((s) => s.setTerm);
  const setLoadError = useStore((s) => s.setLoadError);
  const setAuthRequired = useStore((s) => s.setAuthRequired);
  const setRegistrationsLoading = useStore((s) => s.setRegistrationsLoading);
  const rules = useStore((s) => s.rules);
  const generate = useStore((s) => s.generate);

  useEffect(() => {
    // Same rationale as useIdentity: wait for the live CHECK_LOGIN before
    // hitting Banner so persisted-but-stale auth doesn't trigger fetches.
    if (!liveChecked) return;
    if (!isLoggedIn) return;

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

        const groups = parseActiveRegistrations(registrations, termCode);
        if (groups.size > 0) {
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
    isLoggedIn,
    liveChecked,
    term,
    setCourseGroups,
    setSelectedCourses,
    initializeCurrentRegistrations,
    setTerm,
    setLoadError,
    setAuthRequired,
    setRegistrationsLoading,
  ]);

  useEffect(() => {
    if (courseGroups.size === 0 || selectedCourses.size === 0) return;
    const timer = setTimeout(generate, 200);
    return () => clearTimeout(timer);
  }, [courseGroups, selectedCourses, rules, generate]);
}

export async function refreshAllData(): Promise<void> {
  const state = useStore.getState();
  if (useAuthState.getState().status !== "authenticated") return;

  state.setRegistrationsLoading(true);
  state.setLoadError(null);

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
