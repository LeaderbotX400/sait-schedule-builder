import { useStore } from "../../store";
import RegistrationStatusInline from "./RegistrationStatusInline";

/**
 * The thin GPA + registration-notices strip that sits below the header
 * once the user is connected. Pulls credentials/gpa/registrationNotices
 * directly from the store; renders nothing until the user is signed in
 * AND at least one of GPA or notices has loaded.
 */
export default function ProfileStatusRow() {
  const credentials = useStore((s) => s.credentials);
  const gpa = useStore((s) => s.gpa);
  const registrationNotices = useStore((s) => s.registrationNotices);

  if (!credentials || (!gpa && !registrationNotices)) return null;

  const overallEntry = gpa?.gpas?.find(
    (g) => g.typeDesc === "Overall" || g.gpaTypeIndicatorDesc?.toLowerCase().includes("overall"),
  );
  const displayGpa = gpa?.overallGpa ?? overallEntry?.gpa;
  const displayHours = gpa?.overallHours ?? overallEntry?.hours;

  return (
    <div className="border-b border-gray-800/60 bg-gray-900/40">
      <div className="max-w-screen-2xl mx-auto px-3 sm:px-4 py-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]">
        {displayGpa && (
          <span className="text-gray-400">
            GPA <span className="font-semibold text-gray-200">{displayGpa}</span>
            {displayHours != null && <span className="text-gray-600"> · {displayHours} cr</span>}
          </span>
        )}
        {registrationNotices && <RegistrationStatusInline notices={registrationNotices} />}
      </div>
    </div>
  );
}
