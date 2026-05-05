import { useEffect, useRef, useState } from "react";
import { useStore } from "../../store";
import Popover from "../../ui/Popover";
import StatusDot from "../../ui/StatusDot";

interface Props {
  termLabel?: string | null;
  loading?: boolean;
}

export default function ConnectionStatus({ termLabel, loading }: Props) {
  const setLoggedIn = useStore((s) => s.setLoggedIn);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionAge, setSessionAge] = useState(0);
  const connectedAtRef = useRef<number | null>(Date.now());

  useEffect(() => {
    const id = setInterval(() => {
      if (connectedAtRef.current != null) {
        setSessionAge(Math.floor((Date.now() - connectedAtRef.current) / 1000));
      }
    }, 10000);
    return () => clearInterval(id);
  }, []);

  const stale = sessionAge >= 55 * 60;
  const ageMin = Math.floor(sessionAge / 60);
  const ageLabel = ageMin < 1 ? "just now" : `${ageMin}m ago`;

  const handleReauth = (close: () => void) => {
    setError(null);
    setBusy(true);
    let port: chrome.runtime.Port;
    try {
      port = chrome.runtime.connect({ name: "force-reauth" });
    } catch (e) {
      setBusy(false);
      setError(e instanceof Error ? e.message : "Could not open extension port");
      return;
    }

    let resolved = false;
    const finish = (msg: { ok?: boolean; message?: string }) => {
      if (resolved) return;
      resolved = true;
      setBusy(false);
      if (msg.ok) {
        connectedAtRef.current = Date.now();
        setSessionAge(0);
        setError(null);
        close();
      } else {
        setError(msg.message ?? "Reauth failed");
        setLoggedIn(false);
      }
    };

    port.onMessage.addListener(finish);
    port.onDisconnect.addListener(() => {
      const err = chrome.runtime.lastError;
      finish({ ok: false, message: err?.message ?? "Extension disconnected" });
    });
  };

  const handleDisconnect = (close: () => void) => {
    chrome.runtime.sendMessage({ type: "CLEAR_SESSION" }, () => {
      if (chrome.runtime.lastError) {
        /* ignore */
      }
    });
    setLoggedIn(false);
    close();
  };

  return (
    <Popover
      align="right"
      widthClass="w-60"
      trigger={({ onClick, "aria-expanded": expanded }) => (
        <button
          type="button"
          onClick={onClick}
          aria-expanded={expanded}
          className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs transition-colors ${
            stale
              ? "bg-yellow-900/30 border border-yellow-700/60 text-yellow-300 hover:bg-yellow-900/50"
              : "bg-emerald-900/30 border border-emerald-800/60 text-emerald-300 hover:bg-emerald-900/50"
          }`}
        >
          <StatusDot tone={stale ? "warn" : "ok"} />
          <span className="hidden sm:inline">Connected</span>
          {termLabel && <span className="text-emerald-400/70">· {termLabel}</span>}
          {loading && <span className="text-emerald-400/70 italic">· Loading…</span>}
        </button>
      )}
    >
      {(close) => (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-400">Session age</span>
            <span className={stale ? "text-yellow-400" : "text-gray-200"}>{ageLabel}</span>
          </div>
          {stale && (
            <p className="text-[11px] text-yellow-400">
              Session may have expired. Reauth to refresh.
            </p>
          )}
          <button
            type="button"
            onClick={() => handleReauth(close)}
            disabled={busy}
            className="w-full rounded-md border border-gray-700 px-2.5 py-1.5 text-xs text-gray-300 hover:text-white hover:border-gray-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {busy ? "Waiting for SAIT login…" : "Force Reauth"}
          </button>
          <button
            type="button"
            onClick={() => handleDisconnect(close)}
            className="w-full rounded-md px-2.5 py-1.5 text-xs text-gray-500 hover:text-red-400 transition-colors"
          >
            Disconnect
          </button>
          {error && <p className="text-[11px] text-red-400">{error}</p>}
        </div>
      )}
    </Popover>
  );
}
