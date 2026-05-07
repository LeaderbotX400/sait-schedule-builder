import { describe, expect, it } from "vitest";
import { createBannerSdk } from "../facade";
import { MockTransport } from "../transport/mock";

const PRIME_URL_FRAG = "/ssb/studentProfile/studentProfile";

function shellOk() {
  return {
    ok: true,
    status: 200,
    contentType: "text/html",
    body: "<html></html>",
  } as const;
}

function gpaOk() {
  return {
    ok: true,
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ overallGpa: "3.43", overallHours: 39, gpas: [] }),
  } as const;
}

function holdsOk() {
  return {
    ok: true,
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ count: 0 }),
  } as const;
}

describe("selfService prime", () => {
  it("prime() hits the shell URL once and caches the promise", async () => {
    const transport = new MockTransport().on(PRIME_URL_FRAG, shellOk());
    const sdk = createBannerSdk(transport);

    await Promise.all([sdk.selfService.prime(), sdk.selfService.prime(), sdk.selfService.prime()]);

    const primeCalls = transport.calls.filter((c) => c.url.includes(PRIME_URL_FRAG));
    expect(primeCalls).toHaveLength(1);
  });

  it("auto-primes before /studentProfile/* JSON XHRs", async () => {
    const transport = new MockTransport()
      .on(PRIME_URL_FRAG, shellOk())
      .on("/studentProfile/viewGPAHoursList", gpaOk());
    const sdk = createBannerSdk(transport);

    const gpa = await sdk.selfService.profile.viewGPAHoursList("000967837");

    expect(gpa?.overallGpa).toBe("3.43");
    const urls = transport.calls.map((c) => c.url);
    const primeIdx = urls.findIndex((u) => u.includes(PRIME_URL_FRAG));
    const gpaIdx = urls.findIndex((u) => u.includes("/studentProfile/viewGPAHoursList"));
    expect(primeIdx).toBeGreaterThanOrEqual(0);
    expect(gpaIdx).toBeGreaterThan(primeIdx);
  });

  it("auto-primes before /studentHolds/* XHRs", async () => {
    const transport = new MockTransport()
      .on(PRIME_URL_FRAG, shellOk())
      .on("/studentHolds/getHoldsCountCacheHolds", holdsOk());
    const sdk = createBannerSdk(transport);

    await sdk.selfService.holds.getHoldsCount("000967837");

    const urls = transport.calls.map((c) => c.url);
    const primeIdx = urls.findIndex((u) => u.includes(PRIME_URL_FRAG));
    const holdsIdx = urls.findIndex((u) => u.includes("/studentHolds/"));
    expect(primeIdx).toBeGreaterThanOrEqual(0);
    expect(holdsIdx).toBeGreaterThan(primeIdx);
  });

  it("primes only once when multiple data XHRs fire concurrently", async () => {
    const transport = new MockTransport()
      .on(PRIME_URL_FRAG, shellOk())
      .on("/studentProfile/viewGPAHoursList", gpaOk())
      .on("/studentProfile/viewRegistrationNotices", {
        ok: true,
        status: 200,
        contentType: "application/json",
        body: "{}",
      })
      .on("/studentProfile/viewRegisteredCourseList", {
        ok: true,
        status: 200,
        contentType: "application/json",
        body: "{}",
      });
    const sdk = createBannerSdk(transport);

    await Promise.all([
      sdk.selfService.profile.viewGPAHoursList("000967837"),
      sdk.selfService.profile.viewRegistrationNotices("000967837"),
      sdk.selfService.profile.viewRegisteredCourseList("000967837"),
    ]);

    const primeCalls = transport.calls.filter((c) => c.url.includes(PRIME_URL_FRAG));
    expect(primeCalls).toHaveLength(1);
  });

  it("retries priming after a failed prime", async () => {
    let primeCount = 0;
    const transport = new MockTransport()
      .on(PRIME_URL_FRAG, () => {
        primeCount++;
        if (primeCount === 1) {
          return { ok: false, status: 500, contentType: "application/json", body: "{}" };
        }
        return shellOk();
      })
      .on("/studentProfile/viewGPAHoursList", gpaOk());
    const sdk = createBannerSdk(transport);

    await expect(sdk.selfService.prime()).rejects.toThrow();
    // Second call should retry: prime is no longer cached.
    await expect(sdk.selfService.prime()).resolves.toBeUndefined();
    expect(primeCount).toBe(2);
  });

  it("invalidate() clears the prime cache so subsequent calls re-prime", async () => {
    let primeCount = 0;
    const transport = new MockTransport().on(PRIME_URL_FRAG, () => {
      primeCount++;
      return shellOk();
    });
    const sdk = createBannerSdk(transport);

    await sdk.selfService.prime();
    expect(primeCount).toBe(1);
    sdk.selfService.invalidate();
    await sdk.selfService.prime();
    expect(primeCount).toBe(2);
  });
});
