import { useCallback, useEffect, useRef, useState } from "react";
import { validateLogin, type BannerCredentials } from "../lib/api";
import {
  forceReauth,
  getCredentialsFromExtension,
  triggerLogin,
  waitForExtension
} from "../lib/extension";

const DEV = import.meta.env.DEV;

interface Props {
  onCredentials: (
    creds: BannerCredentials | null,
    studentId?: string | null,
  ) => void;
  isConnected: boolean;
}

export default function HeaderInput({ onCredentials, isConnected }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extensionDetected, setExtensionDetected] = useState<boolean | null>(
    null,
  );
  const [sessionAge, setSessionAge] = useState(0);
  const connectedAtRef = useRef<number | null>(null);

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
      const validation = await validateLogin(result.credentials);
      if (cancelled || !validation.valid) return;
      onCredentials(result.credentials, validation.studentId);
    })();
    return () => {
      cancelled = true;
    };
  }, [isConnected, onCredentials]);

  useEffect(() => {
    if (isConnected) {
      connectedAtRef.current = Date.now();
      setSessionAge(0);
      const id = setInterval(() => {
        setSessionAge(
          Math.floor((Date.now() - connectedAtRef.current!) / 1000),
        );
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

      const result =
        mode === "force" ? await forceReauth() : await triggerLogin();

      if (!result.ok || !result.credentials) {
        setLoading(false);
        setError(result.message ?? "Login failed");
        return;
      }

      const validation = await validateLogin(result.credentials);
      setLoading(false);
      if (!validation.valid) {
        setError(validation.error);
        return;
      }

      onCredentials(result.credentials, validation.studentId);
    },
    [onCredentials],
  );

  const handleDisconnect = useCallback(
    () => onCredentials(null),
    [onCredentials],
  );

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
          <div
            className={`h-2 w-2 rounded-full ${stale ? "bg-yellow-400" : "bg-emerald-400"}`}
          />
          <div className="flex-1 min-w-0">
            <span
              className={`text-sm ${stale ? "text-yellow-300" : "text-emerald-300"}`}
            >
              Connected to Banner
            </span>
            <span
              className={`ml-2 text-xs ${stale ? "text-yellow-500" : "text-gray-600"}`}
            >
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

        <button
          onClick={() => handleLogin("force")}
          disabled={loading}
          className="w-full rounded-lg border border-gray-700 px-3 py-1.5 text-xs text-gray-400 hover:text-white hover:border-gray-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-gray-400 border-r-transparent" />
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
          <code className="text-yellow-300">chrome://extensions</code>, then
          reload this page.
        </p>
      ) : (
        <p className="text-xs text-gray-500">
          A SAIT login window will open. Complete login there and it will close
          automatically.
        </p>
      )}

      <button
        onClick={() => handleLogin("login")}
        disabled={loading || extensionDetected === false}
        className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-r-transparent" />
            Waiting for SAIT login…
          </span>
        ) : (
          "Sign in with SAIT"
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
