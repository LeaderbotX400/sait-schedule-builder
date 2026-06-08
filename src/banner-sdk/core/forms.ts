/** Encode a flat record as application/x-www-form-urlencoded. */
export function formUrlEncoded(params: Record<string, string>): string {
  return new URLSearchParams(params).toString();
}

export const FORM_URLENCODED = "application/x-www-form-urlencoded; charset=UTF-8";
export const JSON_CONTENT = "application/json";
