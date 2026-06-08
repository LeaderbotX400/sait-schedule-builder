import { defineStore } from "pinia";
import { ref } from "vue";
import type { GpaResponse, RegistrationNoticesResponse } from "../banner-sdk/apps/selfService/types";

/**
 * Reactive profile state — GPA and registration notices fetched from
 * Banner's selfService endpoints. Use useProfile() composable at the
 * app root to populate it.
 */
export const useProfileStore = defineStore("profile", () => {
  /** GPA + hours data; null until loaded or after logout. */
  const gpa = ref<GpaResponse | null>(null);
  /** Registration notices (time tickets, status flags); null until loaded or after logout. */
  const registrationNotices = ref<RegistrationNoticesResponse | null>(null);
  /** True while profile data is being fetched. */
  const loading = ref(false);

  function setGpa(value: GpaResponse | null): void {
    gpa.value = value;
  }

  function setRegistrationNotices(value: RegistrationNoticesResponse | null): void {
    registrationNotices.value = value;
  }

  function setLoading(value: boolean): void {
    loading.value = value;
  }

  function reset(): void {
    gpa.value = null;
    registrationNotices.value = null;
    loading.value = false;
  }

  return { gpa, registrationNotices, loading, setGpa, setRegistrationNotices, setLoading, reset };
});
