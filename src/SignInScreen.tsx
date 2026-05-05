import { useState } from "react";
import { useStore } from "./store";
import Card from "./ui/Card";

export default function SignInScreen() {
  const setLoggedIn = useStore((s) => s.setLoggedIn);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = () => {
    setLoading(true);
    setError(null);
    let port: chrome.runtime.Port;
    try {
      port = chrome.runtime.connect({ name: "login" });
    } catch (e) {
      setLoading(false);
      setError(e instanceof Error ? e.message : "Could not open extension port");
      return;
    }

    let resolved = false;
    const finish = (msg: { ok?: boolean; message?: string }) => {
      if (resolved) return;
      resolved = true;
      setLoading(false);
      if (msg.ok) {
        setLoggedIn(true);
      } else {
        setError(msg.message ?? "Login failed. Please try again.");
      }
    };

    port.onMessage.addListener(finish);
    port.onDisconnect.addListener(() => {
      const err = chrome.runtime.lastError;
      finish({
        ok: false,
        message: err?.message ?? "Extension disconnected before login completed.",
      });
    });
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-950 text-gray-100 p-4">
      <Card size="sm">
        <h3 className="text-sm font-medium text-gray-300 mb-3">Connect to SAIT Banner</h3>
        <p className="text-xs text-gray-500 mb-4">
          A SAIT login window will open. Sign in and it will close automatically.
        </p>
        <button
          type="button"
          onClick={handleLogin}
          disabled={loading}
          className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? "Waiting for SAIT login…" : "Sign in with SAIT"}
        </button>
        {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
      </Card>
    </div>
  );
}
