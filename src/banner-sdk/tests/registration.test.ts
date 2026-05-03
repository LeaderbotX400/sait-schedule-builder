import { describe, expect, it } from "vitest";
import { createBannerSdk } from "../facade";
import { MockTransport } from "../transport/mock";

describe("registration.registrations.registerCrns", () => {
  it("stages each CRN and submits the batch", async () => {
    const transport = new MockTransport();
    let stageCount = 0;
    transport.on("/addRegistrationItem", () => {
      stageCount++;
      return {
        ok: true,
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          model: {
            courseReferenceNumber: `CRN${stageCount}`,
            courseRegistrationStatus: "RW",
          },
        }),
      };
    });
    transport.on("/submitRegistration/batch", {
      ok: true,
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: {
          update: [
            {
              courseReferenceNumber: "CRN1",
              courseRegistrationStatus: "RW",
              errorFlag: null,
              crnErrors: [],
              courseTitle: "Course One",
            },
            {
              courseReferenceNumber: "CRN2",
              courseRegistrationStatus: "RW",
              errorFlag: null,
              crnErrors: [],
              courseTitle: "Course Two",
            },
          ],
        },
      }),
    });

    const sdk = createBannerSdk(transport);
    sdk.connect({ synchronizerToken: "sync", uniqueSessionId: "sid" });

    const result = await sdk.registration.registrations.registerCrns("202540", ["CRN1", "CRN2"]);
    expect(result.success).toBe(true);
    expect(result.items).toHaveLength(2);
    expect(result.items[0]?.success).toBe(true);
  });

  it("surfaces per-CRN error details from the batch response", async () => {
    const transport = new MockTransport();
    transport.on("/addRegistrationItem", {
      ok: true,
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        model: { courseReferenceNumber: "CRN9", courseRegistrationStatus: "RE" },
      }),
    });
    transport.on("/submitRegistration/batch", {
      ok: true,
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: {
          update: [
            {
              courseReferenceNumber: "CRN9",
              courseRegistrationStatus: "RE",
              errorFlag: "F",
              crnErrors: [{ message: "Section is full", messageType: "ERROR" }],
              courseTitle: "Database Programming",
            },
          ],
        },
      }),
    });

    const sdk = createBannerSdk(transport);
    sdk.connect({ synchronizerToken: "sync", uniqueSessionId: "sid" });

    const result = await sdk.registration.registrations.registerCrns("202540", ["CRN9"]);
    expect(result.items[0]?.success).toBe(false);
    expect(result.items[0]?.errors[0]?.message).toBe("Section is full");
  });

  it("returns a top-level error if every stage call fails", async () => {
    const transport = new MockTransport();
    transport.on("/addRegistrationItem", {
      ok: true,
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: false, message: "CRN does not exist" }),
    });

    const sdk = createBannerSdk(transport);
    sdk.connect({ synchronizerToken: "sync", uniqueSessionId: "sid" });

    const result = await sdk.registration.registrations.registerCrns("202540", ["BAD"]);
    expect(result.success).toBe(false);
    expect(result.error).toContain("Could not stage any courses");
    expect(result.error).toContain("CRN does not exist");
  });
});

describe("registration.registrations.listActive", () => {
  it("returns the registrations array from the wrapper", async () => {
    const transport = new MockTransport();
    transport.on("/renderActiveRegistrations", {
      ok: true,
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          registrations: [{ subject: "CPRG", courseNumber: "306", courseReferenceNumber: "12345" }],
        },
      }),
    });

    const sdk = createBannerSdk(transport);
    sdk.connect({ synchronizerToken: "sync", uniqueSessionId: "sid" });

    const regs = await sdk.registration.registrations.listActive("202540");
    expect(regs).toHaveLength(1);
    expect(regs[0]?.courseReferenceNumber).toBe("12345");
  });

  it("returns [] when the response has no registrations key", async () => {
    const transport = new MockTransport();
    transport.on("/renderActiveRegistrations", {
      ok: true,
      status: 200,
      contentType: "application/json",
      body: "{}",
    });
    const sdk = createBannerSdk(transport);
    sdk.connect({ synchronizerToken: "sync", uniqueSessionId: "sid" });
    expect(await sdk.registration.registrations.listActive("202540")).toEqual([]);
  });
});
