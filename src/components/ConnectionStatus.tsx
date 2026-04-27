import { useEffect, useRef, useState } from "react";
import { validateCredentials, type BannerCredentials } from "../lib/api";
import { forceReauth } from "../lib/extension";

interface Props {
  onCredentials: (creds: BannerCredentials | null) => void;
  termLabel?: string | null;
}

/**
 * Compact connection pill for the top header. Click to open a small popover
 * with session age, force-reauth, and disconnect controls.
 */
export default function ConnectionStatus({ onCredentials, termLabel }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionAge, setSessionAge] = useState(0);
  const connectedAtRef = useRef<number | null>(Date.now());
  const popRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = setInterval(() => {
      if (connectedAtRef.current != null) {
        setSessionAge(Math.floor((Date.now() - connectedAtRef.current) / 1000));
      }
    }, 10000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (popRef.current && !popRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const stale = sessionAge >= 55 * 60;
  const ageMin = Math.floor(sessionAge / 60);
  const ageLabel = ageMin < 1 ? "just now" : `${ageMin}m ago`;

  const handleReauth = async () => {
    setError(null);
    setLoading(true);
    const result = await forceReauth();
    if (!result.ok || !result.credentials) {
      setLoading(false);
      setError(result.message ?? "Reauth failed");
      return;
    }
    const validation = await validateCredentials(result.credentials);
    setLoading(false);
    if (!validation.valid) {
      setError(validation.error ?? "Captured credentials are not valid");
      return;
    }
    connectedAtRef.current = Date.now();
    setSessionAge(0);
    onCredentials(result.credentials);
    setOpen(false);
  };

  return (
    <div className="relative" ref={popRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs transition-colors ${
          stale
            ? "bg-yellow-900/30 border border-yellow-700/60 text-yellow-300 hover:bg-yellow-900/50"
            : "bg-emerald-900/30 border border-emerald-800/60 text-emerald-300 hover:bg-emerald-900/50"
        }`}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${stale ? "bg-yellow-400" : "bg-emerald-400"}`} />
        Connected
        {termLabel && <span className="text-emerald-400/70">· {termLabel}</span>}
      </button>

      {open && (
        <div className="absolute right-0 mt-1.5 w-60 rounded-lg border border-gray-700 bg-gray-900 shadow-xl p-3 space-y-2 z-30">
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
            onClick={handleReauth}
            disabled={loading}
            className="w-full rounded-md border border-gray-700 px-2.5 py-1.5 text-xs text-gray-300 hover:text-white hover:border-gray-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "Waiting for SAIT login…" : "Force Reauth"}
          </button>
          <button
            onClick={() => {
              onCredentials(null);
              setOpen(false);
            }}
            className="w-full rounded-md px-2.5 py-1.5 text-xs text-gray-500 hover:text-red-400 transition-colors"
          >
            Disconnect
          </button>
          {error && (
            <p className="text-[11px] text-red-400">{error}</p>
          )}
        </div>
      )}
    </div>
  );
}
