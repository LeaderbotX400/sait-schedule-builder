import { createLogger } from "../../../lib/logger";
import { ssag1Url } from "../../config/hosts";
import { bannerRequest, bannerRequestRaw, type RequestContext } from "../../core/request";
import { withNullFallback } from "./fallback";
import type { GpaResponse, RegisteredCourseList, RegistrationNoticesResponse } from "./types";

const log = createLogger("profile");

function studentPath(action: string, studentId: string): string {
  return `/studentProfile/${action}?studentId=${encodeURIComponent(studentId)}`;
}

/** Student-profile endpoints under `/StudentSelfService/studentProfile/`. */
export function createProfileClient(ctx: RequestContext) {
  const url = (action: string, studentId: string) =>
    ssag1Url(ctx.hosts, studentPath(action, studentId));

  return {
    viewGPAHoursList(studentId: string): Promise<GpaResponse | null> {
      return withNullFallback(log, `viewGPAHoursList(${studentId})`, () =>
        bannerRequest<GpaResponse>(ctx, url("viewGPAHoursList", studentId)),
      );
    },

    viewRegistrationNotices(studentId: string): Promise<RegistrationNoticesResponse | null> {
      return withNullFallback(log, `viewRegistrationNotices(${studentId})`, () =>
        bannerRequest<RegistrationNoticesResponse>(ctx, url("viewRegistrationNotices", studentId)),
      );
    },

    viewRegisteredCourseList(studentId: string): Promise<RegisteredCourseList | null> {
      return withNullFallback(log, `viewRegisteredCourseList(${studentId})`, () =>
        bannerRequest<RegisteredCourseList>(ctx, url("viewRegisteredCourseList", studentId)),
      );
    },

    renderCurriculumTemplate(studentId: string): Promise<string | null> {
      return withNullFallback(log, `renderCurriculumTemplate(${studentId})`, async () => {
        const raw = await bannerRequestRaw(ctx, url("renderCurriculumTemplate", studentId));
        return raw.body;
      });
    },
  };
}
