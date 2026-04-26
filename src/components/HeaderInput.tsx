import { useState, useCallback, useEffect } from "react";
import { parseRequestHeaders, validateCredentials, type BannerCredentials } from "../lib/api";
import {
  detectExtension,
  getCredentialsFromExtension,
} from "../lib/extension";

interface Props {
  onCredentials: (creds: BannerCredentials | null) => void;
  isConnected: boolean;
}

const BANNER_LOGIN_URL =
  "https://sait-sust-prd-prd1-ban-ss-ssag6.sait.ca/StudentRegistrationSsb/ssb/registration";

export default function HeaderInput({ onCredentials, isConnected }: Props) {
  const [extId, setExtId] = useState(() =>
    localStorage.getItem("sait-ext-id") ?? "",
  );
  const [extDetected, setExtDetected] = useState(false);
  const [extLoading, setExtLoading] = useState(false);
  const [extError, setExtError] = useState<string | null>(null);
  const [showManual, setShowManual] = useState(false);
  const [text, setText] = useState("");
  const [manualError, setManualError] = useState<string | null>(null);
  const [manualLoading, setManualLoading] = useState(false);

  // Probe the extension whenever the ID changes
  useEffect(() => {
    if (!extId) {
      setExtDetected(false);
      return;
    }
    localStorage.setItem("sait-ext-id", extId);
    detectExtension(extId).then(setExtDetected);
  }, [extId]);

  const handleAutoConnect = useCallback(async () => {
    if (!extId) return;
    setExtLoading(true);
    setExtError(null);

    const result = await getCredentialsFromExtension(extId);
    setExtLoading(false);

    if (result.ok && result.credentials) {
      onCredentials(result.credentials);
    } else {
      setExtError(result.message ?? "Failed to get credentials");
      if (result.loginUrl) {
        window.open(result.loginUrl, "_blank");
      }
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
    return (
      <div className="flex items-center gap-2 rounded-lg bg-emerald-900/30 border border-emerald-800 px-3 py-2">
        <div className="h-2 w-2 rounded-full bg-emerald-400" />
        <span className="text-sm text-emerald-300">Connected to Banner</span>
        <button
          onClick={handleDisconnect}
          className="ml-auto text-xs text-gray-500 hover:text-gray-300"
        >
          Disconnect
        </button>
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
          onClick={handleAutoConnect}
          disabled={!extDetected || extLoading}
          className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {extLoading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-r-transparent" />
              Connecting...
            </span>
          ) : (
            "Auto-Connect"
          )}
        </button>

        {extError && (
          <div className="rounded-lg bg-red-900/30 border border-red-800 px-3 py-2 text-xs text-red-400">
            {extError}
          </div>
        )}

        <p className="text-xs text-gray-600">
          Log into{" "}
          <a
            href={BANNER_LOGIN_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:underline"
          >
            SAIT Banner
          </a>{" "}
          first, then click Auto-Connect
        </p>
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
