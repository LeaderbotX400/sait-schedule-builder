import { acceptHMRUpdate, defineStore } from "pinia";
import { ref } from "vue";

/**
 * Transient cross-cutting UI state — load errors, async flags. Not
 * persisted; every reload starts with no error and not-loading.
 */
export const useUiStore = defineStore("ui", () => {
  const loadError = ref<string | null>(null);
  const registrationsLoading = ref(false);
  const authRequired = ref(false);

  function setLoadError(error: string | null): void {
    loadError.value = error;
  }
  function setRegistrationsLoading(loading: boolean): void {
    registrationsLoading.value = loading;
  }
  function setAuthRequired(required: boolean): void {
    authRequired.value = required;
  }

  return {
    loadError,
    registrationsLoading,
    authRequired,
    setLoadError,
    setRegistrationsLoading,
    setAuthRequired,
  };
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useUiStore, import.meta.hot));
}
