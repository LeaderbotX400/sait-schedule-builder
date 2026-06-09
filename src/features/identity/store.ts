import { acceptHMRUpdate, defineStore } from "pinia";
import { ref } from "vue";

/**
 * Reactive identity state — the resolved student ID after Banner login
 * validation. Use useIdentity() composable at the app root to populate it.
 */
export const useIdentityStore = defineStore("identity", () => {
  /** Resolved Banner student ID; null until validateLogin succeeds or after logout. */
  const studentId = ref<string | null>(null);
  /** Last validation error message; cleared on each new attempt. */
  const lastError = ref<string | null>(null);
  /** True while a validateLogin call is in flight. */
  const validating = ref(false);

  function setStudentId(id: string | null): void {
    studentId.value = id;
  }

  function setLastError(msg: string | null): void {
    lastError.value = msg;
  }

  function setValidating(value: boolean): void {
    validating.value = value;
  }

  function reset(): void {
    studentId.value = null;
    lastError.value = null;
    validating.value = false;
  }

  return { studentId, lastError, validating, setStudentId, setLastError, setValidating, reset };
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useIdentityStore, import.meta.hot));
}
