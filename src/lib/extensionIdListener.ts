import { onMounted, onUnmounted } from "vue";
import { isExtensionContext, recordDetectedExtensionId } from "./extensionId";

/**
 * Captures the EXT_ID broadcast that extension/inject.ts posts on every
 * matched page (localhost, 127.0.0.1, pages.dev). Mount once at the top
 * of the root component (App.vue).
 *
 * inject.ts broadcasts at document_start and also responds to a
 * REQUEST_EXT_ID ping, so we ping once on mount in case the broadcast
 * fired before Vue hydrated.
 */
export function useExtensionIdListener(): void {
  function handleMessage(e: MessageEvent): void {
    if (e.source !== window) return;
    const data = e.data as { source?: string; type?: string; id?: string } | null;
    if (!data || data.source !== "sait-ext" || data.type !== "EXT_ID") return;
    if (typeof data.id === "string" && data.id.length > 0) {
      recordDetectedExtensionId(data.id);
    }
  }

  onMounted(() => {
    if (isExtensionContext()) return;
    if (typeof window === "undefined") return;
    window.addEventListener("message", handleMessage);
    window.postMessage({ source: "sait-app", type: "REQUEST_EXT_ID" }, "*");
  });

  onUnmounted(() => {
    window.removeEventListener("message", handleMessage);
  });
}
