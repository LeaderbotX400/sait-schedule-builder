import { useEffect } from "react";
import { getAuthService, useAuthState } from "../auth";
import { isDemoMode } from "../demo";

export function useDemoBootstrap(): void {
  const status = useAuthState((s) => s.status);

  useEffect(() => {
    if (!isDemoMode()) return;
    if (status === "authenticated") return;
    void getAuthService().login();
  }, [status]);
}
