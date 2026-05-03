// Content script injected into Banner SSB pages.
// Extracts the synchronizer token + uniqueSessionId from the live page DOM
// and forwards them to the background worker.

(() => {
  function extractSyncToken(): string | null {
    const meta = document.querySelector<HTMLMetaElement>('meta[name="synchronizerToken"]');
    if (meta) return meta.getAttribute("content");

    const scripts = document.querySelectorAll<HTMLScriptElement>("script:not([src])");
    for (const script of scripts) {
      const match = script.textContent?.match(
        /synchronizerToken["']?\s*[:=]\s*["']([a-f0-9-]+)["']/i,
      );
      if (match?.[1]) return match[1];
    }

    const input = document.querySelector<HTMLInputElement>('input[name="synchronizerToken"]');
    if (input) return input.value;

    return null;
  }

  function extractUniqueSessionId(): string | null {
    const match = window.location.href.match(/uniqueSessionId=([^&\s]+)/);
    return match?.[1] ?? null;
  }

  setTimeout(() => {
    const token = extractSyncToken();
    const uniqueSessionId = extractUniqueSessionId();
    if (token) {
      chrome.runtime.sendMessage({
        type: "SYNC_TOKEN_FOUND",
        token,
        uniqueSessionId: uniqueSessionId ?? "",
      });
    }
  }, 1500);
})();
