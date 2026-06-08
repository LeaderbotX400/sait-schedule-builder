import { describe, expect, it } from "vitest";
import { createBannerSdk } from "../facade";
import { MockTransport } from "../transport/mock";

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
    expect(await sdk.registration.registrations.listActive("202540")).toEqual([]);
  });
});
