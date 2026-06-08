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
          aria-haspopup="menu"
          aria-label={`Connected to Banner${termLabel ? `, ${termLabel}` : ""}${loading ? ", loading" : ""} — open session menu`}
          className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs transition-colors ${
            isStale
              ? "bg-tint-warning/90 border border-tint-warning-bd text-tint-warning-fg hover:bg-tint-warning"
              : "bg-tint-success/90 border border-tint-success-bd text-tint-success-fg hover:bg-tint-success"
          }`}
        >
          <StatusDot tone={isStale ? "warn" : "ok"} />
          <span className="hidden sm:inline">Connected</span>
          {termLabel && (
            <span className="text-success/70">
              <span className="hidden sm:inline">·&nbsp;</span>
              {termLabel}
            </span>
          )}
          {loading && <span className="text-success/70 italic">· Loading…</span>}
        </button>
      )}
    >
      {(close) => (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-fg-muted">Session age</span>
            <span className={isStale ? "text-warning" : "text-fg"}>{ageLabel}</span>
          </div>
          {isStale && (
            <p className="text-[11px] text-warning">Session may have expired. Reauth to refresh.</p>
          )}
          <button
            type="button"
            onClick={() => void handleReauth(close)}
            disabled={busy}
            className="w-full rounded-md border border-edge px-2.5 py-1.5 text-xs text-fg-muted hover:text-fg hover:border-edge-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {busy ? "Waiting for SAIT login…" : "Force Reauth"}
          </button>
          <button
            type="button"
            onClick={() => void handleDisconnect(close)}
            className="w-full rounded-md border border-tint-danger-bd bg-tint-danger px-2.5 py-1.5 text-xs text-tint-danger-fg hover:bg-destructive hover:text-destructive-fg hover:border-destructive transition-colors"
          >
            Disconnect
          </button>
          {error && <p className="text-[11px] text-destructive">{error}</p>}
        </div>
      )}
    </Popover>
  );
}
