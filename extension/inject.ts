// Injected into the schedule-builder web app when it runs at localhost or
// the production host. Announces the extension ID to the page so the app
// can route Banner traffic through the extension via externally_connectable.

(() => {
  const id = chrome.runtime.id;
  const send = () => window.postMessage({ source: "sait-ext", type: "EXT_ID", id }, "*");
  send();

  window.addEventListener("message", (e) => {
    if (e.source !== window) return;
    const data = e.data;
    if (data && data.source === "sait-app" && data.type === "REQUEST_EXT_ID") send();
  });
})();
