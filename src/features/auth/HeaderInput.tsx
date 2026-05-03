import { useCallback, useEffect, useRef, useState } from "react";
import type { BannerCredentials } from "../../banner-sdk";
import {
  forceReauth,
  getCredentialsFromExtension,
  installBannerCookies,
  triggerLogin,
  waitForExtension,
} from "../../lib/extension";
import { useStore } from "../../store";
import { getSdk } from "../../store/sdk";
import Spinner from "../../ui/Spinner";
import { parsePastedHeaders } from "./parseHeaders";

interface Props {
  isConnected: boolean;
}

/**
 * Initial sign-in card. Talks to the chrome extension for credential
 * capture (via popup or by silent-pickup of an existing session) and
 * supports a manual "paste headers" fallback for users who can't run
 * the extension.
 *
 * State writes go through the store's `setCredentials` action, which
 * routes through the SDK's `connect` for sync-token + uniqueSessionId
 * installation.
 */
export default function HeaderInput({ isConnected }: Props) {
  const setCredentials = useStore((s) => s.setCredentials);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extensionDetected, setExtensionDetected] = useState<boolean | null>(null);
  const [sessionAge, setSessionAge] = useState(0);
  const connectedAtRef = useRef<number | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualText, setManualText] = useState("");

  // Detect the extension and silently pick up an existing session.
  useEffect(() => {
    if (isConnected) return;
    let cancelled = false;
    (async () => {
      const ok = await waitForExtension(2000);
      if (cancelled) return;
      setExtensionDetected(ok);
      if (!ok) return;
      const result = await getCredentialsFromExtension();
      if (cancelled || !result.ok || !result.credentials) return;
      const validation = await getSdk().connectAndValidate(result.credentials);
      if (cancelled || !validation.valid) return;
      setCredentials(result.credentials, validation.studentId);
    })();
    return () => {
      cancelled = true;
    };
  }, [isConnected, setCredentials]);

  useEffect(() => {
    if (isConnected) {
      connectedAtRef.current = Date.now();
      setSessionAge(0);
      const id = setInterval(() => {
        setSessionAge(Math.floor((Date.now() - connectedAtRef.current!) / 1000));
      }, 10000);
      return () => clearInterval(id);
    }
    connectedAtRef.current = null;
    setSessionAge(0);
  }, [isConnected]);

  const handleLogin = useCallback(
    async (mode: "login" | "force") => {
      setError(null);
      setLoading(true);

      const result = mode === "force" ? await forceReauth() : await triggerLogin();

      if (!result.ok || !result.credentials) {
        setLoading(false);
        setError(result.message ?? "Login failed");
        return;
      }

      const validation = await getSdk().connectAndValidate(result.credentials);
      setLoading(false);
      if (!validation.valid) {
        setError(validation.error);
        return;
      }
      setCredentials(result.credentials, validation.studentId);
    },
    [setCredentials],
  );

  const handleDisconnect = useCallback(() => setCredentials(null), [setCredentials]);

  const handleManualSubmit = useCallback(async () => {
    setError(null);
    const parsed = parsePastedHeaders(manualText);
    const jsessionid = parsed.cookies["JSESSIONID"];
    const nlb = parsed.cookies["NLB"];
    if (!jsessionid || !nlb) {
      setError("Couldn't find JSESSIONID and NLB cookies in the pasted Cookie header.");
      return;
    }

    setLoading(true);
    const installed = await installBannerCookies({
      JSESSIONID: jsessionid,
      NLB: nlb,
    });
    if (!installed.ok) {
      setLoading(false);
      setError(installed.message ?? "Failed to install cookies via extension.");
      return;
    }

    const creds: BannerCredentials = {
      synchronizerToken: parsed.synchronizerToken ?? "",
      uniqueSessionId: parsed.uniqueSessionId ?? "",
    };
    const validation = await getSdk().connectAndValidate(creds);
    setLoading(false);
    if (!validation.valid) {
      setError(validation.error);
      return;
    }
    setCredentials(creds, validation.studentId);
    setManualOpen(false);
    setManualText("");
  }, [manualText, setCredentials]);

  if (isConnected) {
    const ageMin = Math.floor(sessionAge / 60);
    const stale = sessionAge >= 55 * 60;
    const ageLabel = ageMin < 1 ? "just now" : `${ageMin}m ago`;

    return (
      <div className="space-y-2">
        <div
          className={`flex items-center gap-2 rounded-lg px-3 py-2 ${
            stale
              ? "bg-yellow-900/30 border border-yellow-700"
              : "bg-emerald-900/30 border border-emerald-800"
          }`}
        >
          <div className={`h-2 w-2 rounded-full ${stale ? "bg-yellow-400" : "bg-emerald-400"}`} />
          <div className="flex-1 min-w-0">
            <span className={`text-sm ${stale ? "text-yellow-300" : "text-emerald-300"}`}>
              Connected to Banner
            </span>
            <span className={`ml-2 text-xs ${stale ? "text-yellow-500" : "text-gray-600"}`}>
              {ageLabel}
            </span>
          </div>
          <button
            type="button"
            onClick={handleDisconnect}
            className="text-xs text-gray-600 hover:text-gray-400"
          >
            Disconnect
          </button>
        </div>

        {stale && (
          <div className="rounded-lg bg-yellow-900/20 border border-yellow-800 px-3 py-2 text-xs text-yellow-400">
            Session may have expired — reconnect to refresh your credentials.
          </div>
        )}

        <button
          type="button"
          onClick={() => handleLogin("force")}
          disabled={loading}
          className="w-full rounded-lg border border-gray-700 px-3 py-1.5 text-xs text-gray-400 hover:text-white hover:border-gray-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <Spinner size="xs" color="text-gray-400" />
              Waiting for SAIT login…
            </span>
          ) : (
            "Force Reauth"
          )}
        </button>

        {error && (
          <div className="rounded-lg bg-red-900/30 border border-red-800 px-3 py-2 text-xs text-red-400">
            {error}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-gray-300">Connect to Banner</h3>
      {extensionDetected === false ? (
        <p className="text-xs text-yellow-400">
          Schedule Builder extension not detected. Install/load it from{" "}
          <code className="text-yellow-300">chrome://extensions</code>, then reload this page.
        </p>
      ) : (
        <p className="text-xs text-gray-500">
          A SAIT login window will open. Complete login there and it will close automatically.
        </p>
      )}

      <button
        type="button"
        onClick={() => handleLogin("login")}
        disabled={loading || extensionDetected === false}
        className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <Spinner size="sm" color="text-white" />
            Waiting for SAIT login…
          </span>
        ) : (
          "Sign in with SAIT"
        )}
      </button>

      <button
        type="button"
        onClick={() => setManualOpen((v) => !v)}
        className="w-full text-xs text-gray-500 hover:text-gray-300 transition-colors"
      >
        {manualOpen ? "Cancel manual entry" : "Paste headers manually"}
      </button>

      {manualOpen && (
        <div className="space-y-2 rounded-lg border border-gray-800 bg-gray-900/50 p-3">
          <p className="text-xs text-gray-500">
            DevTools → Network → any Banner request → Copy → Copy Request Headers. We'll pull{" "}
            <code className="text-gray-400">X-Synchronizer-Token</code> +{" "}
            <code className="text-gray-400">JSESSIONID</code>/
            <code className="text-gray-400">NLB</code> cookies.
          </p>
          <textarea
            value={manualText}
            onChange={(e) => setManualText(e.target.value)}
            placeholder={
              "GET /StudentRegistrationSsb/... HTTP/1.1\nCookie: JSESSIONID=...; NLB=...\nX-Synchronizer-Token: ..."
            }
            rows={6}
            className="w-full resize-y rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 font-mono text-xs text-gray-200 placeholder-gray-600 focus:border-blue-500 focus:outline-none"
          />
          <button
            type="button"
            onClick={handleManualSubmit}
            disabled={loading || !manualText.trim()}
            className="w-full rounded-lg bg-gray-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "Validating…" : "Use these headers"}
          </button>
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-red-900/30 border border-red-800 px-3 py-2 text-xs text-red-400">
          {error}
        </div>
      )}
    </div>
  );
}
