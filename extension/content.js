// Content script injected into Banner SSB pages.
// Extracts the synchronizer token and session ID, then sends them
// to the background script so they're available when the web app asks.

(function () {
  function extractSyncToken() {
    // Method 1: meta tag
    const meta = document.querySelector(
      'meta[name="synchronizerToken"]',
    );
    if (meta) return meta.getAttribute("content");

    // Method 2: look for it in inline scripts
    const scripts = document.querySelectorAll("script:not([src])");
    for (const script of scripts) {
      const match = script.textContent.match(
        /synchronizerToken["']?\s*[:=]\s*["']([a-f0-9-]+)["']/i,
      );
      if (match) return match[1];
    }

    // Method 3: hidden input
    const input = document.querySelector(
      'input[name="synchronizerToken"]',
    );
    if (input) return input.value;

    return null;
  }

  function extractUniqueSessionId() {
    const match = window.location.href.match(
      /uniqueSessionId=([^&\s]+)/,
    );
    return match ? match[1] : null;
  }

  // Wait a moment for the page to fully render dynamic content
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
