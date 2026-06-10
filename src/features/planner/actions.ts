import { BannerAuthRequiredError } from "@/banner-sdk";
import type { BannerResponse } from "@/banner-sdk/apps/registration/types";
import { parseActiveRegistrations, parseBannerData } from "@/domain/parser";
import type { CourseSection, SavedSchedule, Schedule } from "@/domain/types";
import { useAuthStore } from "@/features/auth/store";
import { useCatalogStore } from "@/features/catalog/store";
import { useCurrentRegStore } from "@/features/current/store";
import { useRulesStore } from "@/features/rules/store";
import { type GenerateInput } from "@/features/schedules/executor";
import { useSchedulesStore } from "@/features/schedules/store";
import { useSelectionStore } from "@/features/selection/store";
import { useTermStore } from "@/features/term/store";
import { type SlotWarning, useUiStore } from "@/features/ui-state/store";
import { getSdk } from "@/lib/sdk";
import { mergeTermOptions } from "@/lib/terms";

/**
 * Cross-store planner workflows. Stores never call each other's actions —
 * every multi-store mutation is a named, awaitable function here, so the
 * cascade for any user action can be read top-to-bottom in one place.
 */

/** Drop these Banner term flavours from the picker — they can't be planned against. */
const SKIP_TERMS = ["(View Only)", "(View only)", "Non-Credit", "Apprentice"];

function plannableTerms<T extends { description: string }>(terms: T[]): T[] {
  return terms.filter((t) => !SKIP_TERMS.some((skip) => t.description.includes(skip)));
}

/** Assemble the scheduler's input from the active term's planner state. */
export function currentGenerateInput(): GenerateInput {
  const catalog = useCatalogStore();
  const selection = useSelectionStore();

  const courses = new Map<string, CourseSection[]>();
  for (const [name, sections] of catalog.courseGroups) {
    if (selection.selectedCourses.has(name)) courses.set(name, sections);
  }
  return {
    courses,
    rules: useRulesStore().rules,
    pinnedCrns: selection.pinnedSections,
  };
}

/** Regenerate schedules from the current planner inputs. */
export async function regenerate(): Promise<Schedule[]> {
  useUiStore().setLoadError(null);
  return useSchedulesStore().generate(currentGenerateInput());
}

/**
 * The term cascade, as one named function: set the term, wipe the
 * derived schedules + transient UI, and pull fresh Banner data for the
 * new term. Only the term picker and `loadSavedSchedule` call this;
 * nothing else writes `term`.
 */
export async function switchTerm(termCode: string): Promise<void> {
  const term = useTermStore();
  if (term.term === termCode) return;
  term.set(termCode);
  useSchedulesStore().clearSchedules();
  useUiStore().resetTransient();
  await syncActiveTerm({ background: false });
}

/**
 * Merge a Banner search response into the planner: catalog merge +
 * selection union + schedules reset. Returns the section count.
 */
export function addSearchResults(response: BannerResponse): number {
  const ui = useUiStore();

  if (!response.data || response.data.length === 0) {
    ui.setLoadError(
      "Banner returned no course sections. Double-check that the course codes exist for the selected term.",
    );
    return 0;
  }
  const newGroups = parseBannerData(response);
  if (newGroups.size === 0) {
    ui.setLoadError("Received data but no valid course sections could be parsed.");
    return 0;
  }

  useCatalogStore().mergeCourseGroups(newGroups);
  useSelectionStore().setSelectedCourses((prev) => {
    const next = new Set(prev);
    for (const name of newGroups.keys()) next.add(name);
    return next;
  });
  useSchedulesStore().clearSchedules();
  ui.setLoadError(null);

  return response.data.length;
}

/** Drop a course from the catalog and every dependent slice. */
export function removeCourse(subjectCourse: string): void {
  useCatalogStore().removeCourse(subjectCourse);
  useSelectionStore().forgetCourse(subjectCourse);
  useCurrentRegStore().forgetCourse(subjectCourse);
  useSchedulesStore().clearSchedules();
}

/** Wipe the active term's planner state. */
export function clearTermData(): void {
  useCatalogStore().clearCourses();
  useSelectionStore().setSelectedCourses(new Set());
  useSelectionStore().clearPins();
  useCurrentRegStore().clearCurrentReg();
  useSchedulesStore().clearSchedules();
  useUiStore().setLoadError(null);
}

/** Stage a section swap against the active catalog. */
export function swapSection(
  subjectCourse: string,
  newSectionId: string,
): { success: boolean; conflicts: CourseSection[] } {
  return useCurrentRegStore().swapSection(
    subjectCourse,
    newSectionId,
    useCatalogStore().courseGroups,
  );
}

/** The current-registration schedule resolved against the active catalog. */
export function getCurrentSchedule(): Schedule | null {
  return useCurrentRegStore().getCurrentSchedule(useCatalogStore().courseGroups);
}

/**
 * Reload a saved schedule: switch terms if needed, re-fetch its courses
 * from Banner, rehydrate catalog + selection, regenerate, then seek the
 * generated schedule that best matches the saved picks.
 */
export async function loadSavedSchedule(saved: SavedSchedule): Promise<void> {
  try {
    if (saved.termCode !== useTermStore().term) {
      useTermStore().set(saved.termCode);
      useSchedulesStore().clearSchedules();
      useUiStore().resetTransient();
    }

    const result = await getSdk().registration.search.byCourses(
      saved.picks.map((p) => p.subjectCourse),
      saved.termCode,
    );
    const groups = parseBannerData(result.response);

    const validSelection = new Set<string>();
    for (const pick of saved.picks) {
      if (groups.has(pick.subjectCourse)) validSelection.add(pick.subjectCourse);
    }

    useCatalogStore().setCourseGroups(groups);
    useSelectionStore().setSelectedCourses(validSelection);

    const schedulesStore = useSchedulesStore();
    const generated = await schedulesStore.generate(currentGenerateInput());

    const pickSet = new Set(saved.picks.map((p) => p.identifier));
    let bestIndex = 0;
    let bestCount = -1;
    for (let i = 0; i < generated.length; i++) {
      const count = generated[i]!.courses.filter((c) => pickSet.has(c.identifier)).length;
      if (count > bestCount) {
        bestCount = count;
        bestIndex = i;
      }
    }
    schedulesStore.setActiveScheduleIndex(bestIndex);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    useUiStore().setLoadError("Could not load saved schedule: " + message);
  }
}

// --- Banner term sync ---------------------------------------------------

/** Banner's term-prime occasionally responds before student data is ready; one retry usually fixes it. */
const SYNC_RETRY_MS = 1500;

/** Internal signal: zero registrations came back — retry once, then stay silent. */
class NoRegistrationsError extends Error {
  constructor() {
    super("no active registrations");
    this.name = "NoRegistrationsError";
  }
}

let syncRunId = 0;

/**
 * Pull the plannable term list + the active term's data from Banner and
 * apply it to the planner stores. Latest-wins: a re-entrant call (term
 * switched mid-flight, auth re-validated) supersedes the in-flight one.
 *
 * Resolution for the active term:
 *  - live registrations exist → catalog + selection + currentReg seeded
 *  - none, but a persisted selection slot exists (future planning term)
 *    → revalidate the slot against a fresh class search
 *  - neither → retry once for Banner lag, then leave the UI as-is
 */
export async function syncActiveTerm(opts: { background: boolean }): Promise<void> {
  const myRunId = ++syncRunId;
  const ui = useUiStore();
  ui.setRegistrationsLoading(true);
  ui.setLoadError(null);

  try {
    let attempt = 0;
    for (;;) {
      try {
        await syncOnce();
        return;
      } catch (err) {
        if (myRunId !== syncRunId) return;
        if (err instanceof BannerAuthRequiredError) {
          ui.setLoadError(err.message);
          ui.setAuthRequired(true);
          return;
        }
        if (attempt >= 1) {
          if (err instanceof NoRegistrationsError) return; // silent — nothing to plan against
          const msg = err instanceof Error ? err.message : String(err);
          const prefix = opts.background
            ? "Could not load your registrations"
            : "Could not refresh your registrations";
          ui.setLoadError(`${prefix}: ${msg}. Try reconnecting to Banner.`);
          return;
        }
        attempt++;
        await new Promise((resolve) => setTimeout(resolve, SYNC_RETRY_MS));
        if (myRunId !== syncRunId) return;
      }
    }
  } finally {
    if (myRunId === syncRunId) ui.setRegistrationsLoading(false);
  }

  async function syncOnce(): Promise<void> {
    const sdk = getSdk();
    const termStore = useTermStore();

    const banner = await sdk.registration.terms.list();
    if (myRunId !== syncRunId) return;
    if (banner.length === 0) {
      throw new Error("Banner returned no terms — session may be invalid");
    }

    const plannable = plannableTerms(banner);
    termStore.setTermOptions(mergeTermOptions(plannable));

    // Retarget if the active term isn't plannable — same run continues
    // with the corrected term; no watcher re-entrancy dance.
    let termCode = termStore.term;
    if (!plannable.some((t) => t.code === termCode)) {
      const fallback = plannable[0]?.code;
      if (!fallback) return; // nothing plannable at all
      termCode = fallback;
      termStore.set(termCode);
      useSchedulesStore().clearSchedules();
      useUiStore().resetTransient();
    }

    const registrations = await sdk.registration.registrations.listActive(termCode);
    if (myRunId !== syncRunId) return;

    const groups = parseActiveRegistrations(registrations, termCode);
    if (groups.size > 0) {
      applyRegistrationSnapshot(groups);
      return;
    }

    // No live registrations — revalidate a persisted planning slot if one exists.
    const persisted = useSelectionStore().slots.get(termCode);
    if (persisted && persisted.courses.size > 0) {
      await revalidateSlot(termCode, [...persisted.courses]);
      return;
    }
    throw new NoRegistrationsError();
  }

  async function revalidateSlot(termCode: string, codes: string[]): Promise<void> {
    const result = await getSdk().registration.search.byCourses(codes, termCode);
    if (myRunId !== syncRunId) return;
    const groups = parseBannerData(result.response);

    const warnings: SlotWarning[] = [];

    // Drop courses Banner no longer offers for this term.
    const validSelection = new Set<string>();
    for (const code of codes) {
      if (groups.has(code)) validSelection.add(code);
      else warnings.push({ kind: "course-dropped", subjectCourse: code });
    }

    useCatalogStore().setCourseGroups(groups);
    useSelectionStore().setSelectedCourses(validSelection);

    // Swap stale section overrides (course exists, that section doesn't).
    for (const s of useCurrentRegStore().reconcileOverrides(groups)) {
      warnings.push({
        kind: "section-swapped",
        subjectCourse: s.subjectCourse,
        fromIdentifier: s.fromIdentifier,
      });
    }

    useUiStore().setSlotWarnings(warnings);
  }
}

/** Apply live registrations to catalog/selection/currentReg. */
function applyRegistrationSnapshot(groups: Map<string, CourseSection[]>): void {
  useCatalogStore().setCourseGroups(groups);
  useSelectionStore().setSelectedCourses((prev) => {
    const restored = new Set([...prev].filter((name) => groups.has(name)));
    return restored.size > 0 ? restored : new Set(groups.keys());
  });

  const current = useCurrentRegStore();
  current.initializeFromGroups(groups);

  const swapped = current.reconcileOverrides(groups);
  if (swapped.length > 0) {
    useUiStore().setSlotWarnings(
      swapped.map(
        (s): SlotWarning => ({
          kind: "section-swapped",
          subjectCourse: s.subjectCourse,
          fromIdentifier: s.fromIdentifier,
        }),
      ),
    );
  }
}

/** Imperative one-shot refresh for manual "Refresh" buttons. */
export async function refreshAllData(): Promise<void> {
  if (useAuthStore().status !== "authenticated") return;
  await syncActiveTerm({ background: false });
}
