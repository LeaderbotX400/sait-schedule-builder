import { useEffect } from "react";
import { useStore } from "../store";

export function useAuth(): void {
  const setLoggedIn = useStore((s) => s.setLoggedIn);

  useEffect(() => {
    // Check login state on mount.
    chrome.runtime.sendMessage(
      { type: "CHECK_LOGIN" },
      (res: { loggedIn?: boolean } | undefined) => {
        if (chrome.runtime.lastError) return;
        setLoggedIn(res?.loggedIn ?? false);
      },
    );

    // Listen for login state pushed from the SW after login flow completes.
    const onMessage = (msg: { type?: string; loggedIn?: boolean }) => {
      if (msg.type === "LOGIN_STATE_CHANGED") {
        setLoggedIn(msg.loggedIn ?? false);
      }
    };
    chrome.runtime.onMessage.addListener(onMessage);
    return () => chrome.runtime.onMessage.removeListener(onMessage);
  }, [setLoggedIn]);
}
