import type { RegistrationNoticesResponse } from "../../banner-sdk/apps/selfService/types";

interface Props {
  notices: RegistrationNoticesResponse;
}

export default function RegistrationStatusInline({ notices }: Props) {
  const blocked =
    notices.regStudentStatus?.allowsRegistration === false ||
    (notices.timeTickets?.length ?? 0) > 0 ||
    notices.academicStanding?.preventsRegistration != null;

  if (blocked) {
    return (
      <span className="text-yellow-400">
        ⚠ Registration blocked
        {notices.academicStanding?.description && ` · ${notices.academicStanding.description}`}
        {(notices.timeTickets?.length ?? 0) > 0 &&
          ` · ${notices.timeTickets!.length} time ticket${notices.timeTickets!.length === 1 ? "" : "s"}`}
      </span>
    );
  }

  return (
    <span className="text-gray-400">
      <span className="text-emerald-400">●</span>{" "}
      {notices.standingAsOf?.fullDescription ??
        notices.regStudentStatus?.description ??
        "Registration open"}
    </span>
  );
}
