import { create } from "zustand";
import type { GpaResponse, RegisteredCourseList } from "../banner-sdk/apps/selfService/types";

export interface ProfileStateShape {
  gpa: GpaResponse | null;
  registeredCourses: RegisteredCourseList | null;
  curriculumHtml: string | null;
  busy: boolean;
  error: string | null;

  setData: (data: {
    gpa: GpaResponse | null;
    registeredCourses: RegisteredCourseList | null;
    curriculumHtml: string | null;
  }) => void;
  setBusy: (busy: boolean) => void;
  setError: (msg: string | null) => void;
  reset: () => void;
}

export const useProfileState = create<ProfileStateShape>((set) => ({
  gpa: null,
  registeredCourses: null,
  curriculumHtml: null,
  busy: false,
  error: null,

  setData: ({ gpa, registeredCourses, curriculumHtml }) =>
    set({ gpa, registeredCourses, curriculumHtml }),
  setBusy: (busy) => set({ busy }),
  setError: (error) => set({ error }),
  reset: () =>
    set({
      gpa: null,
      registeredCourses: null,
      curriculumHtml: null,
      busy: false,
      error: null,
    }),
}));
