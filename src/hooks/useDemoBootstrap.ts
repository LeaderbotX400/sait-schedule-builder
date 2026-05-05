import { useEffect } from "react";
import { isDemoMode } from "../demo";
import { useStore } from "../store";

export function useDemoBootstrap(): void {
  const isLoggedIn = useStore((s) => s.isLoggedIn);
  const setLoggedIn = useStore((s) => s.setLoggedIn);

  useEffect(() => {
    if (!isDemoMode()) return;
    if (isLoggedIn) return;
    setLoggedIn(true);
  }, [isLoggedIn, setLoggedIn]);
}
