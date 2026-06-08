import { onMounted } from "vue";
import { getAuthService } from "../auth/service";
import { useAuthStore } from "../auth/store";
import { isDemoMode } from "../demo";

/**
 * Automatically initiates authentication when the app runs in demo mode
 * and the user is not yet authenticated. Mount once at the root of App.vue
 * next to the other side-effect composables. No-op outside demo mode.
 */
export function useDemoBootstrap(): void {
  onMounted(() => {
    if (!isDemoMode()) return;
    const auth = useAuthStore();
    if (auth.status === "authenticated") return;
    void getAuthService().login();
  });
}
