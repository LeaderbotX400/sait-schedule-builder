import { type BannerHostConfig, ssag1Url } from "../../config/hosts";
import { bannerHeaders } from "../../core/headers";
import { bannerRequest, bannerRequestRaw } from "../../core/request";
import type { SyncTokenCache } from "../../core/syncToken";
import type { BannerTransport } from "../../transport/types";
import type { GpaResponse, RegisteredCourseList, RegistrationNoticesResponse } from "./types";

interface Ctx {
  transport: BannerTransport;
  hosts: BannerHostConfig;
  tokens: SyncTokenCache;
}

function studentPath(action: string, studentId: string): string {
  return `/studentProfile/${action}?studentId=${encodeURIComponent(studentId)}`;
}

/** Student-profile endpoints under `/StudentSelfService/studentProfile/`. */
export function createProfileClient(
  transport: BannerTransport,
  hosts: BannerHostConfig,
  tokens: SyncTokenCache,
) {
  const ctx: Ctx = { transport, hosts, tokens };

  return {
    async viewGPAHoursList(studentId: string): Promise<GpaResponse | null> {
      try {
        return await bannerRequest<GpaResponse>(
          ctx,
          ssag1Url(ctx.hosts, studentPath("viewGPAHoursList", studentId)),
          { headers: bannerHeaders() },
        );
      } catch {
        return null;
      }
    },

    async viewRegistrationNotices(studentId: string): Promise<RegistrationNoticesResponse | null> {
      try {
        return await bannerRequest<RegistrationNoticesResponse>(
          ctx,
          ssag1Url(ctx.hosts, studentPath("viewRegistrationNotices", studentId)),
          { headers: bannerHeaders() },
        );
      } catch {
        return null;
      }
    },

    async viewRegisteredCourseList(studentId: string): Promise<RegisteredCourseList | null> {
      try {
        return await bannerRequest<RegisteredCourseList>(
          ctx,
          ssag1Url(ctx.hosts, studentPath("viewRegisteredCourseList", studentId)),
          { headers: bannerHeaders() },
        );
      } catch {
        return null;
      }
    },

    /** HTML fragment — Banner returns the curriculum block rendered as HTML. */
    async renderCurriculumTemplate(studentId: string): Promise<string | null> {
      try {
        const raw = await bannerRequestRaw(
          ctx,
          ssag1Url(ctx.hosts, studentPath("renderCurriculumTemplate", studentId)),
          { headers: bannerHeaders() },
        );
        return raw.body;
      } catch {
        return null;
      }
    },
  };
}
