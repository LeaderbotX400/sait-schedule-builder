import { useMemo } from "react";
import type { Schedule } from "../../domain/types";
import { useStore } from "../../store";
import RegistrationResult from "./RegistrationResult";
import { useRegistration } from "./useRegistration";

interface Props {
  schedule: Schedule;
}

/**
 * The full "Register This Schedule" flow: button → confirmation dialog →
 * loading state → per-CRN result list. Pulls credentials, term, and the
 * currently-registered CRN set from the store; everything else comes
 * from the schedule prop.
 */
export default function RegistrationButton({ schedule }: Props) {
  const credentials = useStore((s) => s.credentials);
  const term = useStore((s) => s.term);
  const currentRegistrations = useStore((s) => s.currentRegistrations);
  const { state, begin, cancel, dismiss, register } = useRegistration();

  const registeredCrns = useMemo(
    () =>
      currentRegistrations.size > 0
        ? new Set([...currentRegistrations.values()].map((r) => r.currentSection.crn))
        : new Set<string>(),
    [currentRegistrations],
  );

  const newCrns = useMemo(
    () => schedule.courses.map((c) => c.crn).filter((crn) => !registeredCrns.has(crn)),
    [schedule.courses, registeredCrns],
  );

  if (!credentials || !term) return null;

  return (
    <div className="space-y-2">
      {state.kind === "idle" &&
        (newCrns.length > 0 ? (
          <button
            type="button"
            onClick={begin}
            className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 transition-colors"
          >
            Register This Schedule ({newCrns.length} new course{newCrns.length !== 1 ? "s" : ""})
          </button>
        ) : (
          <div className="rounded-lg bg-emerald-900/30 border border-emerald-800 px-3 py-2 text-xs text-emerald-300">
            All courses in this schedule are already registered.
          </div>
        ))}

      {state.kind === "confirming" && (
        <div className="rounded-lg bg-yellow-900/20 border border-yellow-800 p-3 space-y-3">
          <p className="text-sm text-yellow-200 font-medium">
            Register {newCrns.length} course{newCrns.length !== 1 ? "s" : ""} in Banner?
          </p>
          <ul className="space-y-0.5">
            {schedule.courses
              .filter((c) => newCrns.includes(c.crn))
              .map((c) => (
                <li key={c.crn} className="text-xs text-gray-300">
                  {c.identifier} — {c.title} <span className="text-gray-500">(CRN {c.crn})</span>
                </li>
              ))}
          </ul>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void register(term, newCrns)}
              className="flex-1 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500 transition-colors"
            >
              Confirm Registration
            </button>
            <button
              type="button"
              onClick={cancel}
              className="rounded-lg bg-gray-700 px-3 py-1.5 text-sm text-gray-200 hover:bg-gray-600 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {state.kind === "loading" && (
        <div className="rounded-lg bg-gray-800 border border-gray-700 px-4 py-3 flex items-center gap-3">
          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-blue-400 border-r-transparent" />
          <span className="text-sm text-gray-300">Registering courses in Banner…</span>
        </div>
      )}

      {state.kind === "done" && <RegistrationResult result={state.result} onDismiss={dismiss} />}
    </div>
  );
}
