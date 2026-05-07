import { createLogger } from "../../../lib/logger";
import { type BannerHostConfig, ssag1Url } from "../../config/hosts";
import { bannerRequest, bannerRequestRaw } from "../../core/request";
import type { BannerTransport } from "../../transport/types";
import type { GpaResponse, RegisteredCourseList, RegistrationNoticesResponse } from "./types";

const log = createLogger("profile");

interface Ctx {
  transport: BannerTransport;
  hosts: BannerHostConfig;
}

function studentPath(action: string, studentId: string): string {
  return `/studentProfile/${action}?studentId=${encodeURIComponent(studentId)}`;
}

function describe(err: unknown): string {
  return err instanceof Error ? `${err.name}: ${err.message}` : String(err);
}

/** Student-profile endpoints under `/StudentSelfService/studentProfile/`. */
export function createProfileClient(transport: BannerTransport, hosts: BannerHostConfig) {
  const ctx: Ctx = { transport, hosts };

  return {
    async viewGPAHoursList(studentId: string): Promise<GpaResponse | null> {
      try {
        return await bannerRequest<GpaResponse>(
          ctx,
          ssag1Url(ctx.hosts, studentPath("viewGPAHoursList", studentId)),
        );
      } catch (err) {
        log.warn(`viewGPAHoursList(${studentId}) failed — ${describe(err)}`);
        return null;
      }
    },

    async viewRegistrationNotices(studentId: string): Promise<RegistrationNoticesResponse | null> {
      try {
        return await bannerRequest<RegistrationNoticesResponse>(
          ctx,
          ssag1Url(ctx.hosts, studentPath("viewRegistrationNotices", studentId)),
        );
      } catch (err) {
        log.warn(`viewRegistrationNotices(${studentId}) failed — ${describe(err)}`);
        return null;
      }
    },

    async viewRegisteredCourseList(studentId: string): Promise<RegisteredCourseList | null> {
      try {
        return await bannerRequest<RegisteredCourseList>(
          ctx,
          ssag1Url(ctx.hosts, studentPath("viewRegisteredCourseList", studentId)),
        );
      } catch (err) {
        log.warn(`viewRegisteredCourseList(${studentId}) failed — ${describe(err)}`);
        return null;
      }
    },

    async renderCurriculumTemplate(studentId: string): Promise<string | null> {
      try {
        const raw = await bannerRequestRaw(
          ctx,
          ssag1Url(ctx.hosts, studentPath("renderCurriculumTemplate", studentId)),
        );
        return raw.body;
      } catch (err) {
        log.warn(`renderCurriculumTemplate(${studentId}) failed — ${describe(err)}`);
        return null;
      }
    },
  };
}
