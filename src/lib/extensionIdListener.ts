import { useEffect } from "react";
import { isExtensionContext, recordDetectedExtensionId } from "./extensionId";

/**
 * Captures the EXT_ID broadcast that extension/inject.ts posts on every
 * matched page (localhost, 127.0.0.1, pages.dev). Mounted once in App.tsx.
 *
 * inject.ts broadcasts at document_start and also responds to a
 * REQUEST_EXT_ID ping, so we ping once on mount in case the broadcast
 * fired before React hydrated.
 */
export function useExtensionIdListener(): void {
  useEffect(() => {
    if (isExtensionContext()) return;
    if (typeof window === "undefined") return;

    const onMessage = (e: MessageEvent) => {
      if (e.source !== window) return;
      const data = e.data as { source?: string; type?: string; id?: string } | null;
      if (!data || data.source !== "sait-ext" || data.type !== "EXT_ID") return;
      if (typeof data.id === "string" && data.id.length > 0) {
        recordDetectedExtensionId(data.id);
      }
    };

    window.addEventListener("message", onMessage);
    window.postMessage({ source: "sait-app", type: "REQUEST_EXT_ID" }, "*");

    return () => {
      window.removeEventListener("message", onMessage);
    };
  }, []);
}
