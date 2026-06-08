import type { BannerHostConfig } from "../../config/hosts";
import type { BannerTransport } from "../../transport/types";
import { type LoginValidation, validateLogin } from "./identity";

export function createGeneralClient(transport: BannerTransport, hosts: BannerHostConfig) {
  return {
    identity: {
      validateLogin: (): Promise<LoginValidation> => validateLogin(transport, hosts),
    },
  };
}

export type GeneralClient = ReturnType<typeof createGeneralClient>;
export type { LoginValidation } from "./identity";
