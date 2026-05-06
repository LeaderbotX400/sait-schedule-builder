import { useEffect } from "react";
import { useIdentityState } from "../identity";
import { useStore } from "../store";
import { loadRegistrationStatus } from "./service";
import { useRegistrationStatusState } from "./state";

export function useRegistrationStatus(): void {
  const studentId = useIdentityState((s) => s.studentId);
  const term = useStore((s) => s.term);

  useEffect(() => {
    if (studentId) {
      void loadRegistrationStatus(studentId);
    } else {
      useRegistrationStatusState.getState().reset();
    }
  }, [studentId, term]);
}
