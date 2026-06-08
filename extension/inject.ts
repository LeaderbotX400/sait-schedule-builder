(() => {
  const id = chrome.runtime.id;
  const send = () =>
    window.postMessage({ source: "sait-ext", type: "EXT_ID", id }, "*");
  send();

  window.addEventListener("message", (e) => {
    if (e.source !== window) return;
    const data = e.data as { source?: string; type?: string } | null;
    if (data?.source === "sait-app" && data?.type === "REQUEST_EXT_ID") send();
  });
})();
