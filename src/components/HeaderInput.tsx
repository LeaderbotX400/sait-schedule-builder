import { useCallback, useEffect, useRef, useState } from "react";
import { type BannerCredentials, validateLogin } from "../lib/api";
import {
  forceReauth,
  getCredentialsFromExtension,
  installBannerCookies,
  triggerLogin,
  waitForExtension,
} from "../lib/extension";

interface Props {
  onCredentials: (creds: BannerCredentials | null, studentId?: string | null) => void;
  isConnected: boolean;
}

interface ParsedHeaders {
  synchronizerToken?: string;
  uniqueSessionId?: string;
  cookies: Record<string, string>;
}

/**
 * Pull auth tokens out of a pasted block of browser request headers
 * (DevTools → Network → Copy → Copy Request Headers). Looks for the
 * X-Synchronizer-Token header, the Cookie header (extracts JSESSIONID +
 * NLB), and the uniqueSessionId query param embedded in the request line.
 */
function parsePastedHeaders(text: string): ParsedHeaders {
  const out: ParsedHeaders = { cookies: {} };

  const sessionIdMatch = text.match(/uniqueSessionId=([^&\s]+)/);
  if (sessionIdMatch?.[1]) out.uniqueSessionId = sessionIdMatch[1];

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const colon = line.indexOf(":");
    if (colon <= 0) continue;
    const value = line.slice(colon + 1).trim();
    if (!value) continue;

    // if (name === "x-synchronizer-token") {
    //   out.synchronizerToken = value;
    // } else if (name === "cookie") {
    //   for (const pair of value.split(";")) {
    //     const eq = pair.indexOf("=");
    //     if (eq <= 0) continue;
    //     out.cookies[pair.slice(0, eq).trim()] = pair.slice(eq + 1).trim();
    //   }
    // }
  }

  // if (!out.synchronizerToken) {
  //   const meta = text.match(
  //     /synchronizerToken["']?\s*[:=]\s*["']([a-f0-9-]{8,})["']/i,
  //   );
  //   if (meta) out.synchronizerToken = meta[1];
  // }

  return out;
}

export default function HeaderInput({ onCredentials, isConnected }: Props) {
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

  const handleDisconnect = useCallback(() => onCredentials(null), [onCredentials]);

  const handleManualSubmit = useCallback(async () => {
    setError(null);
    const parsed = parsePastedHeaders(manualText);
    // if (!parsed.synchronizerToken) {
    //   setError(
    //     "Couldn't find X-Synchronizer-Token in the pasted text. In DevTools → Network, copy the request headers from any /StudentRegistrationSsb call.",
    //   );
    //   return;
    // }
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
    const validation = await validateLogin(creds);
    setLoading(false);
    if (!validation.valid) {
      setError(validation.error);
      return;
    }
    onCredentials(creds, validation.studentId);
    setManualOpen(false);
    setManualText("");
  }, [manualText, onCredentials]);

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
          <button onClick={handleDisconnect} className="text-xs text-gray-600 hover:text-gray-400">
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
          <code className="text-yellow-300">chrome://extensions</code>, then reload this page.
        </p>
      ) : (
        <p className="text-xs text-gray-500">
          A SAIT login window will open. Complete login there and it will close automatically.
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

      <button
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
