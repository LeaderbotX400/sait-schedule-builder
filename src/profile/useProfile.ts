import { useEffect } from "react";
import { useIdentityState } from "../identity";
import { loadProfile } from "./service";
import { useProfileState } from "./state";

export function useProfile(): void {
  const studentId = useIdentityState((s) => s.studentId);

  useEffect(() => {
    if (studentId) {
      void loadProfile(studentId);
    } else {
      useProfileState.getState().reset();
    }
  }, [studentId]);
}
