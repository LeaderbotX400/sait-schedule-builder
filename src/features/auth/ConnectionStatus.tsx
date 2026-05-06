import { useAuth } from "../../auth";
import Popover from "../../ui/Popover";
import StatusDot from "../../ui/StatusDot";

interface Props {
  termLabel?: string | null;
  loading?: boolean;
}

export default function ConnectionStatus({ termLabel, loading }: Props) {
  const { busy, error, isStale, sessionAgeSeconds, reauth, disconnect } = useAuth();

  const ageMin = Math.floor(sessionAgeSeconds / 60);
  const ageLabel = ageMin < 1 ? "just now" : `${ageMin}m ago`;

  const handleReauth = async (close: () => void) => {
    const result = await reauth();
    if (result.ok) close();
  };

  const handleDisconnect = async (close: () => void) => {
    await disconnect();
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
            isStale
              ? "bg-yellow-900/30 border border-yellow-700/60 text-yellow-300 hover:bg-yellow-900/50"
              : "bg-emerald-900/30 border border-emerald-800/60 text-emerald-300 hover:bg-emerald-900/50"
          }`}
        >
          <StatusDot tone={isStale ? "warn" : "ok"} />
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
            <span className={isStale ? "text-yellow-400" : "text-gray-200"}>{ageLabel}</span>
          </div>
          {isStale && (
            <p className="text-[11px] text-yellow-400">
              Session may have expired. Reauth to refresh.
            </p>
          )}
          <button
            type="button"
            onClick={() => void handleReauth(close)}
            disabled={busy}
            className="w-full rounded-md border border-gray-700 px-2.5 py-1.5 text-xs text-gray-300 hover:text-white hover:border-gray-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {busy ? "Waiting for SAIT login…" : "Force Reauth"}
          </button>
          <button
            type="button"
            onClick={() => void handleDisconnect(close)}
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
