import { acceptHMRUpdate, defineStore } from "pinia";
import { computed, ref } from "vue";
import { AUTH_STALE_AFTER_MS, type AuthStatus } from "./types";

/**
 * Reactive auth state. Mutations go through the typed actions so the
 * AuthService can drive state changes without touching component code.
 * Components read via the [[useAuth]] composable, which adds the
 * orchestration actions (login/reauth/disconnect) on top.
 *
 * `tick` is bumped by a low-frequency interval in [[useAuthInit]] so
 * the age-derived `computed`s recompute even though `acquiredAt`
 * itself hasn't changed.
 */
export const useAuthStore = defineStore("auth", () => {
  const status = ref<AuthStatus>("unknown");
  const acquiredAt = ref<number | null>(null);
  const lastError = ref<string | null>(null);
  const busy = ref(false);
  /**
   * Set once the first live CHECK_LOGIN completes. Downstream side-effect
   * composables (identity, profile, schedule sync) gate on this so they
   * don't fire against persisted-but-stale "authenticated" state.
   */
  const liveChecked = ref(false);
  const tick = ref(0);
  /**
   * Banner-level identity, resolved by validateLogin once authenticated
   * (the deeper check behind the cookie-level CHECK_LOGIN). Cleared on
   * logout/expiry. Folded in from the old identity feature.
   */
  const studentId = ref<string | null>(null);
  const validating = ref(false);

  const sessionAgeSeconds = computed(() => {
    if (acquiredAt.value == null) return 0;
    void tick.value; // re-evaluate when tick changes
    return Math.floor((Date.now() - acquiredAt.value) / 1000);
  });

  const isStale = computed(() => {
    if (status.value !== "authenticated" || acquiredAt.value == null) return false;
    void tick.value;
    return Date.now() - acquiredAt.value >= AUTH_STALE_AFTER_MS;
  });

  function setStatus(next: AuthStatus, when?: number | null): void {
    status.value = next;
    if (next === "authenticated") {
      acquiredAt.value = when ?? acquiredAt.value ?? Date.now();
    } else {
      acquiredAt.value = null;
    }
  }

  function setBusy(value: boolean): void {
    busy.value = value;
  }

  function setError(message: string | null): void {
    lastError.value = message;
  }

  function markLiveChecked(): void {
    liveChecked.value = true;
  }

  function bumpTick(): void {
    tick.value++;
  }

  function setStudentId(id: string | null): void {
    studentId.value = id;
  }

  function setValidating(value: boolean): void {
    validating.value = value;
  }

  function reset(): void {
    status.value = "unauthenticated";
    acquiredAt.value = null;
    lastError.value = null;
    busy.value = false;
    liveChecked.value = true;
    studentId.value = null;
    validating.value = false;
  }

  return {
    status,
    acquiredAt,
    lastError,
    busy,
    liveChecked,
    tick,
    studentId,
    validating,
    sessionAgeSeconds,
    isStale,
    setStatus,
    setBusy,
    setError,
    markLiveChecked,
    bumpTick,
    setStudentId,
    setValidating,
    reset,
  };
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useAuthStore, import.meta.hot));
}
