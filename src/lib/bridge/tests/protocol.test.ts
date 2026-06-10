import { describe, expect, it, vi } from "vitest";
import { type BridgeHandlers, createBridgeRouter } from "../protocol";

function makeHandlers(): BridgeHandlers {
  return {
    PING: () => ({ ok: true, version: "1.0.0" }),
    CHECK_LOGIN: async () => ({ loggedIn: true }),
    CLEAR_SESSION: async () => ({ ok: true }),
    BANNER_FETCH: async (req) => ({
      ok: true,
      status: 200,
      contentType: "application/json",
      body: `fetched:${req.url}`,
    }),
    BANNER_PRIME: async () => ({ ok: true }),
  };
}

describe("createBridgeRouter", () => {
  it("answers synchronous handlers inline and returns false", () => {
    const route = createBridgeRouter(makeHandlers());
    const sendResponse = vi.fn();
    const keepOpen = route({ type: "PING" }, sendResponse);
    expect(keepOpen).toBe(false);
    expect(sendResponse).toHaveBeenCalledWith({ ok: true, version: "1.0.0" });
  });

  it("returns true for async handlers and delivers the response later", async () => {
    const route = createBridgeRouter(makeHandlers());
    const sendResponse = vi.fn();
    const keepOpen = route(
      { type: "BANNER_FETCH", url: "https://x.sait.ca/foo" },
      sendResponse,
    );
    expect(keepOpen).toBe(true);
    expect(sendResponse).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(sendResponse).toHaveBeenCalled());
    expect(sendResponse).toHaveBeenCalledWith({
      ok: true,
      status: 200,
      contentType: "application/json",
      body: "fetched:https://x.sait.ca/foo",
    });
  });

  it("ignores unknown and malformed messages", () => {
    const route = createBridgeRouter(makeHandlers());
    const sendResponse = vi.fn();
    expect(route({ type: "NOT_A_THING" }, sendResponse)).toBe(false);
    expect(route("string", sendResponse)).toBe(false);
    expect(route(null, sendResponse)).toBe(false);
    expect(route({ no: "type" }, sendResponse)).toBe(false);
    expect(sendResponse).not.toHaveBeenCalled();
  });
});
