import { computed, type ComputedRef } from "vue";
import type { RegistrationNoticesResponse } from "../banner-sdk/apps/selfService/types";
import { useProfileStore } from "../profile/store";

/**
 * Derived registration-status composable. Mount once at the app root (App.vue).
 * Registration notices are already fetched by useProfile(); this composable
 * exposes them as a typed computed so consumers don't depend on the profile
 * store directly.
 */
export function useRegistrationStatus(): {
  registrationNotices: ComputedRef<RegistrationNoticesResponse | null>;
} {
  const profileStore = useProfileStore();
  const registrationNotices = computed(() => profileStore.registrationNotices);
  return { registrationNotices };
}
