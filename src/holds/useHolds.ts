import { useEffect } from "react";
import { useIdentityState } from "../identity";
import { loadHolds } from "./service";
import { useHoldsState } from "./state";

export function useHolds(): void {
  const studentId = useIdentityState((s) => s.studentId);

  useEffect(() => {
    if (studentId) {
      void loadHolds(studentId);
    } else {
      useHoldsState.getState().reset();
    }
  }, [studentId]);
}
