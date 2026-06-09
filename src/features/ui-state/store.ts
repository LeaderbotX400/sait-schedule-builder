import { acceptHMRUpdate, defineStore } from "pinia";
import { ref } from "vue";

/**
 * Warning surfaced after revalidating a persisted future-term slot
 * against a fresh Banner search. Drives the banner in MainArea.
 *
 * - `course-dropped`: the saved subjectCourse has no sections for
 *   this term anymore; it was removed from the selection.
 * - `section-swapped`: a saved sectionOverride identifier is no
 *   longer offered; the override was cleared so the default
 *   (first available) section is used.
 */
export type SlotWarning =
  | { kind: "course-dropped"; subjectCourse: string }
  | { kind: "section-swapped"; subjectCourse: string; fromIdentifier: string };

/**
 * Transient cross-cutting UI state — load errors, async flags. Not
 * persisted; every reload starts with no error and not-loading.
 */
export const useUiStore = defineStore("ui", () => {
  const loadError = ref<string | null>(null);
  const registrationsLoading = ref(false);
  const authRequired = ref(false);
  const slotWarnings = ref<SlotWarning[]>([]);

  function setLoadError(error: string | null): void {
    loadError.value = error;
  }
  function setRegistrationsLoading(loading: boolean): void {
    registrationsLoading.value = loading;
  }
  function setAuthRequired(required: boolean): void {
    authRequired.value = required;
  }
  function setSlotWarnings(warnings: SlotWarning[]): void {
    slotWarnings.value = warnings;
  }
  function clearSlotWarnings(): void {
    slotWarnings.value = [];
  }

  return {
    loadError,
    registrationsLoading,
    authRequired,
    slotWarnings,
    setLoadError,
    setRegistrationsLoading,
    setAuthRequired,
    setSlotWarnings,
    clearSlotWarnings,
  };
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useUiStore, import.meta.hot));
}
