import { describe, expect, it } from "vitest";
import { createBannerSdk } from "../facade";
import { MockTransport } from "../transport/mock";

describe("registration.search.byCourses", () => {
  it("primes the term once and aggregates per-code results", async () => {
    const transport = new MockTransport();
    transport.on("/saveTerm", {
      ok: true,
      status: 200,
      contentType: "application/json",
      body: "{}",
    });
    transport.on("/term/search", {
      ok: true,
      status: 200,
      contentType: "application/json",
      body: "{}",
    });
    transport.on("/fetchUsageTracking", {
      ok: true,
      status: 200,
      contentType: "application/json",
      body: "{}",
    });
    transport.on("/searchResults/searchResults", {
      ok: true,
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        totalCount: 1,
        data: [{ courseReferenceNumber: "12345" }],
      }),
    });

    const sdk = createBannerSdk(transport, { uniqueSessionId: "sid-1" });
    const result = await sdk.registration.search.byCourses(["CPRG306", "CPRG307"], "202540");

    expect(result.perCode).toEqual([
      { code: "CPRG306", count: 1 },
      { code: "CPRG307", count: 1 },
    ]);
    expect(result.response.data).toHaveLength(2);

    // Term primed exactly once: 4 priming calls + 2 search calls = 6 total.
    expect(transport.calls.length).toBe(6);
    const primingCalls = transport.calls.filter(
      (c) => c.url.includes("/saveTerm") || c.url.includes("/term/search"),
    );
    expect(primingCalls.length).toBe(2);
  });

  it("records per-code errors without throwing the whole batch", async () => {
    const transport = new MockTransport();
    transport.on("/saveTerm", {
      ok: true,
      status: 200,
      contentType: "application/json",
      body: "{}",
    });
    transport.on("/term/search", {
      ok: true,
      status: 200,
      contentType: "application/json",
      body: "{}",
    });
    transport.on("/fetchUsageTracking", {
      ok: true,
      status: 200,
      contentType: "application/json",
      body: "{}",
    });
    transport.on("/searchResults/searchResults", {
      ok: false,
      status: 500,
      contentType: "application/json",
      body: "{}",
    });

    const sdk = createBannerSdk(transport, { uniqueSessionId: "sid-1" });
    const result = await sdk.registration.search.byCourses(["CPRG306"], "202540");

    expect(result.perCode[0]?.error).toContain("HTTP 500");
    expect(result.response.data).toHaveLength(0);
  });

  it("attaches the right query params to searchResults", async () => {
    const transport = new MockTransport();
    transport.on(/\//, {
      ok: true,
      status: 200,
      contentType: "application/json",
      body: '{"success":true,"totalCount":0,"data":[]}',
    });
    const sdk = createBannerSdk(transport, { uniqueSessionId: "sid-42" });
    await sdk.registration.search.byCourse("CPRG306", "202540");

    const searchCall = transport.calls.find((c) => c.url.includes("/searchResults/searchResults"));
    expect(searchCall).toBeDefined();
    const url = new URL(searchCall!.url);
    expect(url.searchParams.get("txt_subjectcoursecombo")).toBe("CPRG306");
    expect(url.searchParams.get("txt_term")).toBe("202540");
    expect(url.searchParams.get("uniqueSessionId")).toBe("sid-42");
    expect(url.searchParams.get("pageMaxSize")).toBe("500");
    expect(url.searchParams.get("sortColumn")).toBe("subjectDescription");
  });
});
