import { describe, expect, it } from "vitest";
import { BannerHttpError } from "../transport/errors";

describe("BannerHttpError", () => {
  it("uses plain message when body has no errorMessage meta", () => {
    const err = new BannerHttpError(500, "{}");
    expect(err.message).toBe("Banner returned HTTP 500.");
    expect(err.bannerMessage).toBeNull();
  });

  it("extracts errorMessage from a Banner Grails error page", () => {
    const body =
      '<!DOCTYPE html><html><head>' +
      '<meta name="errorCode" content="404"/>' +
      '<meta name="errorMessage" content="Sorry, This page is not available."/>' +
      "</head><body></body></html>";
    const err = new BannerHttpError(404, body);
    expect(err.bannerMessage).toBe("Sorry, This page is not available.");
    expect(err.message).toBe("Banner returned HTTP 404: Sorry, This page is not available.");
  });

  it("decodes HTML entities in the extracted message", () => {
    const body =
      '<meta name="errorMessage" content="Cannot get property &#39;primaryCurriculum&#39; on null object"/>';
    const err = new BannerHttpError(500, body);
    expect(err.bannerMessage).toBe(
      "Cannot get property 'primaryCurriculum' on null object",
    );
  });

  it("stays null when body is empty", () => {
    const err = new BannerHttpError(503, "");
    expect(err.bannerMessage).toBeNull();
    expect(err.message).toBe("Banner returned HTTP 503.");
  });
});
