import type { RegistrationBatchResult } from "../../banner-sdk/apps/registration/types";

interface Props {
  result: RegistrationBatchResult;
  onDismiss: () => void;
}

/** Per-CRN success/failure list shown after a registration submit. */
export default function RegistrationResult({ result, onDismiss }: Props) {
  return (
    <div className="space-y-2">
      {result.error && (
        <div className="rounded-lg bg-red-900/30 border border-red-800 px-3 py-2 text-xs text-red-400">
          {result.error}
        </div>
      )}
      {result.items.map((item) => (
        <div
          key={item.crn}
          className={`rounded-lg px-3 py-2 flex items-start gap-2 ${
            item.success
              ? "bg-emerald-900/20 border border-emerald-800"
              : "bg-red-900/20 border border-red-800"
          }`}
        >
          <span className={`text-sm mt-0.5 ${item.success ? "text-emerald-400" : "text-red-400"}`}>
            {item.success ? "✓" : "✗"}
          </span>
          <div className="flex-1 min-w-0">
            <p
              className={`text-xs font-medium ${item.success ? "text-emerald-300" : "text-red-300"}`}
            >
              {item.courseTitle}
              <span className="text-gray-500 ml-1 font-normal">(CRN {item.crn})</span>
            </p>
            {item.errors.length > 0 && (
              <ul className="mt-0.5 space-y-0.5">
                {item.errors.map((e) => (
                  <li
                    key={`${e.messageType}:${e.message}`}
                    className="text-xs text-red-400 flex items-baseline gap-1.5"
                  >
                    {e.messageType && (
                      <span className="shrink-0 font-mono text-[10px] bg-red-900/50 px-1 rounded">
                        {e.messageType}
                      </span>
                    )}
                    {e.message}
                  </li>
                ))}
              </ul>
            )}
            {item.success && <p className="text-xs text-gray-500">Status: {item.finalStatus}</p>}
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={onDismiss}
        className="text-xs text-gray-500 hover:text-gray-300"
      >
        Dismiss
      </button>
    </div>
  );
}
