import { useState, useCallback, useEffect, useRef } from "react";
import { parseRequestHeaders, validateCredentials, type BannerCredentials } from "../lib/api";
import {
  detectExtension,
  triggerLogin,
  forceReauth,
} from "../lib/extension";

interface Props {
  onCredentials: (creds: BannerCredentials | null) => void;
  isConnected: boolean;
}


export default function HeaderInput({ onCredentials, isConnected }: Props) {
  const [extId, setExtId] = useState(() =>
    localStorage.getItem("sait-ext-id") ?? "",
  );
  const [extDetected, setExtDetected] = useState(false);
  const [extLoading, setExtLoading] = useState(false);
  const [extError, setExtError] = useState<string | null>(null);
  const [sessionAge, setSessionAge] = useState(0); // seconds since connected
  const connectedAtRef = useRef<number | null>(null);
  const [showManual, setShowManual] = useState(false);
  const [text, setText] = useState("");
  const [manualError, setManualError] = useState<string | null>(null);
  const [manualLoading, setManualLoading] = useState(false);

  // Track session age
  useEffect(() => {
    if (isConnected) {
      connectedAtRef.current = Date.now();
      setSessionAge(0);
      const id = setInterval(() => {
        setSessionAge(Math.floor((Date.now() - connectedAtRef.current!) / 1000));
      }, 10000); // update every 10s
      return () => clearInterval(id);
    } else {
      connectedAtRef.current = null;
      setSessionAge(0);
    }
  }, [isConnected]);

  // Probe the extension whenever the ID changes
  useEffect(() => {
    if (!extId) {
      setExtDetected(false);
      return;
    }
    localStorage.setItem("sait-ext-id", extId);
    detectExtension(extId).then(setExtDetected);
  }, [extId]);

  const handleLogin = useCallback(async () => {
    if (!extId) return;
    setExtError(null);

    setExtLoading(true);
    const result = await triggerLogin(extId);
    setExtLoading(false);

    if (result.ok && result.credentials) {
      onCredentials(result.credentials);
    } else {
      setExtError(result.message ?? "Login failed");
    }
  }, [extId, onCredentials]);

  const handleManualSubmit = useCallback(async () => {
    setManualError(null);
    setManualLoading(true);

    try {
      const creds = parseRequestHeaders(text);
      
      // Validate credentials before marking as connected
      const validation = await validateCredentials(creds);
      if (!validation.valid) {
        setManualError(validation.error ?? "Credentials are not valid");
        setManualLoading(false);
        return;
      }

      // Credentials are valid, mark as connected
      onCredentials(creds);
    } catch (e) {
      setManualError(e instanceof Error ? e.message : "Failed to parse headers");
    } finally {
      setManualLoading(false);
    }
  }, [text, onCredentials]);

  const handleDisconnect = useCallback(() => {
    onCredentials(null);
  }, [onCredentials]);

  if (isConnected) {
    const ageMin = Math.floor(sessionAge / 60);
    const stale = sessionAge >= 55 * 60; // warn at 55 min
    const ageLabel = ageMin < 1 ? "just now" : `${ageMin}m ago`;

    return (
      <div className="space-y-2">
        <div className={`flex items-center gap-2 rounded-lg px-3 py-2 ${stale ? "bg-yellow-900/30 border border-yellow-700" : "bg-emerald-900/30 border border-emerald-800"}`}>
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

        {extId && (
          <button
            onClick={async () => {
              setExtError(null);
              setExtLoading(true);
              const result = await forceReauth(extId);
              setExtLoading(false);
              if (result.ok && result.credentials) {
                onCredentials(result.credentials);
              } else {
                setExtError(result.message ?? "Reauth failed");
              }
            }}
            disabled={!extDetected || extLoading}
            className="w-full rounded-lg border border-gray-700 px-3 py-1.5 text-xs text-gray-400 hover:text-white hover:border-gray-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {extLoading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-gray-400 border-r-transparent" />
                Waiting for SAIT login…
              </span>
            ) : (
              "Force Reauth"
            )}
          </button>
        )}

        {extError && (
          <div className="rounded-lg bg-red-900/30 border border-red-800 px-3 py-2 text-xs text-red-400">
            {extError}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium text-gray-300">
        Connect to Banner
      </h3>

      {/* Extension auto-connect */}
      <div className="space-y-2">
        <label className="block text-xs text-gray-400">
          Extension ID
          <span className="text-gray-600 ml-1">(from chrome://extensions)</span>
        </label>
        <input
          value={extId}
          onChange={(e) => setExtId(e.target.value.trim())}
          placeholder="abcdefghijklmnopqrstuvwxyz..."
          className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-1.5 text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
        />

        {extId && (
          <div className="flex items-center gap-2 text-xs">
            <div
              className={`h-1.5 w-1.5 rounded-full ${extDetected ? "bg-emerald-400" : "bg-gray-600"}`}
            />
            <span className={extDetected ? "text-emerald-400" : "text-gray-500"}>
              {extDetected ? "Extension detected" : "Extension not found"}
            </span>
          </div>
        )}

        <button
          onClick={handleLogin}
          disabled={!extDetected || extLoading}
          className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {extLoading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-r-transparent" />
              Waiting for SAIT login…
            </span>
          ) : (
            "Login with SAIT"
          )}
        </button>

        {extLoading && (
          <p className="text-xs text-gray-500 text-center">
            A SAIT login tab will open — complete login there and it will close automatically.
          </p>
        )}

        {extError && (
          <div className="rounded-lg bg-red-900/30 border border-red-800 px-3 py-2 text-xs text-red-400">
            {extError}
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-800" />
        </div>
        <div className="relative flex justify-center">
          <button
            onClick={() => setShowManual(!showManual)}
            className="bg-gray-900 px-2 text-xs text-gray-600 hover:text-gray-400"
          >
            {showManual ? "Hide manual input" : "Paste headers manually"}
          </button>
        </div>
      </div>

      {/* Manual header paste (collapsed by default) */}
      {showManual && (
        <div className="space-y-2">
          <p className="text-xs text-gray-500">
            DevTools (F12) &rarr; Network &rarr; right-click any Banner
            request &rarr; Copy request headers
          </p>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={5}
            placeholder={"Cookie: JSESSIONID=...\nX-Synchronizer-Token: ..."}
            className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
          />
          {manualError && (
            <div className="rounded-lg bg-red-900/30 border border-red-800 px-3 py-2 text-xs text-red-400">
              {manualError}
            </div>
          )}
          <button
            onClick={handleManualSubmit}
            disabled={!text.trim() || manualLoading}
            className="w-full rounded-lg bg-gray-700 px-4 py-2 text-sm font-medium text-gray-200 hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {manualLoading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-gray-200 border-r-transparent" />
                Validating...
              </span>
            ) : (
              "Connect with Headers"
            )}
          </button>
        </div>
      )}
    </div>
  );
}
