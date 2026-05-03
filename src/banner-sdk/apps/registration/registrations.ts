import { ssag6Url } from "../../config/hosts";
import { JSON_CONTENT } from "../../core/forms";
import { bannerHeaders } from "../../core/headers";
import { bannerRequest } from "../../core/request";
import type { RegistrationSession } from "../../core/session";
import { BannerValidationError } from "../../transport/errors";
import type {
  ActiveRegistration,
  RegistrationBatchResult,
  RegistrationItemResult,
  RegistrationModel,
} from "./types";

interface ActiveRegistrationsResponse {
  data?: { registrations?: ActiveRegistration[] };
}

interface StageResponse {
  success?: boolean;
  model?: RegistrationModel;
  message?: string;
}

interface BatchSubmitResponse {
  success?: boolean;
  data?: { update?: RegistrationModel[] };
}

/**
 * Registration cart endpoints under `/ssb/classRegistration/` and
 * `/ssb/registrationHistory/`.
 */
export function createRegistrationsClient(session: RegistrationSession) {
  /** All currently-registered courses for the given term. */
  async function listActive(term: string): Promise<ActiveRegistration[]> {
    const params = new URLSearchParams({ term });
    const res = await bannerRequest<ActiveRegistrationsResponse>(
      session,
      ssag6Url(session.hosts, `/ssb/registrationHistory/renderActiveRegistrations?${params}`),
    );
    return res?.data?.registrations ?? [];
  }

  /**
   * Stage a single CRN for registration. Returns the opaque RegistrationModel
   * blob Banner expects to be echoed back in `submitBatch`.
   */
  async function stageAdd(term: string, crn: string): Promise<RegistrationModel> {
    const params = new URLSearchParams({
      term,
      courseReferenceNumber: crn,
      olr: "false",
    });
    const res = await bannerRequest<StageResponse>(
      session,
      ssag6Url(session.hosts, `/ssb/classRegistration/addRegistrationItem?${params}`),
    );
    if (!res?.success || !res.model) {
      throw new BannerValidationError(res?.message ?? `Banner rejected CRN ${crn}`);
    }
    return res.model;
  }

  /** Submit a pre-built {create, update, destroy} batch. */
  async function submitBatch(updateModels: RegistrationModel[]): Promise<RegistrationBatchResult> {
    const submittedCrns = new Set(updateModels.map((m) => m.courseReferenceNumber));

    let res: BatchSubmitResponse;
    try {
      res = await bannerRequest<BatchSubmitResponse>(
        session,
        ssag6Url(session.hosts, "/ssb/classRegistration/submitRegistration/batch"),
        {
          method: "POST",
          headers: bannerHeaders({
            syncToken: session.tokens.get(),
            contentType: JSON_CONTENT,
          }),
          body: JSON.stringify({ create: [], update: updateModels, destroy: [] }),
        },
      );
    } catch (e) {
      return {
        success: false,
        items: [],
        error: e instanceof Error ? e.message : String(e),
      };
    }

    if (!res.success) {
      return {
        success: false,
        items: [],
        error: "Banner rejected the batch submission",
      };
    }

    const allUpdated = res.data?.update ?? [];
    const items: RegistrationItemResult[] = allUpdated
      .filter((item) => submittedCrns.has(item.courseReferenceNumber))
      .map((item) => {
        const crn = item.courseReferenceNumber;
        const finalStatus = item.courseRegistrationStatus;
        const errorFlag = (item.errorFlag as string | null) ?? null;
        const rawErrors = (item.crnErrors as Array<Record<string, unknown>> | undefined) ?? [];
        const errors = rawErrors.map((e) => ({
          message: typeof e.message === "string" ? e.message : JSON.stringify(e),
          messageType: typeof e.messageType === "string" ? e.messageType : "",
        }));
        const success = finalStatus === "RW" && errorFlag !== "F" && errors.length === 0;
        return {
          crn,
          courseTitle: (item.courseTitle as string | undefined) ?? crn,
          finalStatus,
          errorFlag,
          errors,
          success,
        };
      });

    return { success: true, items };
  }

  /**
   * One-shot helper: stage + commit each CRN in turn, surface per-item errors
   * but never throw before attempting the batch.
   */
  async function registerCrns(term: string, crns: string[]): Promise<RegistrationBatchResult> {
    const models: RegistrationModel[] = [];
    const stageErrors: string[] = [];

    for (const crn of crns) {
      try {
        models.push(await stageAdd(term, crn));
      } catch (e) {
        stageErrors.push(`CRN ${crn}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    if (models.length === 0) {
      return {
        success: false,
        items: [],
        error: `Could not stage any courses: ${stageErrors.join("; ")}`,
      };
    }

    const result = await submitBatch(models);
    if (stageErrors.length > 0) {
      result.error = [result.error, `Could not stage: ${stageErrors.join("; ")}`]
        .filter(Boolean)
        .join(" | ");
    }
    return result;
  }

  return { listActive, stageAdd, submitBatch, registerCrns };
}
