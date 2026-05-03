import { describe, expect, it } from "vitest";
import { parsePastedHeaders } from "../parseHeaders";

describe("parsePastedHeaders", () => {
  it("returns empty cookies + no tokens for empty input", () => {
    expect(parsePastedHeaders("")).toEqual({ cookies: {} });
  });

  it("parses uniqueSessionId from a request-line URL", () => {
    const result = parsePastedHeaders(
      "GET /ssb/term/saveTerm?term=202540&uniqueSessionId=sched12345 HTTP/1.1",
    );
    expect(result.uniqueSessionId).toBe("sched12345");
  });

  it("parses the X-Synchronizer-Token header", () => {
    const text = `GET /foo HTTP/1.1
Host: example.com
X-Synchronizer-Token: abcd1234-5678-90ef
`;
    expect(parsePastedHeaders(text).synchronizerToken).toBe("abcd1234-5678-90ef");
  });

  it("parses JSESSIONID and NLB from a Cookie header", () => {
    const text = "Cookie: JSESSIONID=AAAA111; NLB=BBBB222; foo=bar";
    const result = parsePastedHeaders(text);
    expect(result.cookies["JSESSIONID"]).toBe("AAAA111");
    expect(result.cookies["NLB"]).toBe("BBBB222");
    expect(result.cookies["foo"]).toBe("bar");
  });

  it("is case-insensitive for header names", () => {
    const text = "x-Synchronizer-Token: TOK\nCookie: JSESSIONID=ABC";
    const result = parsePastedHeaders(text);
    expect(result.synchronizerToken).toBe("TOK");
    expect(result.cookies["JSESSIONID"]).toBe("ABC");
  });

  it("skips header-less lines and blank lines", () => {
    const text = "\nGET /foo HTTP/1.1\n\nCookie: JSESSIONID=X\n";
    expect(parsePastedHeaders(text).cookies["JSESSIONID"]).toBe("X");
  });

  it("skips Cookie pairs that are missing an =", () => {
    const text = "Cookie: bad-cookie; JSESSIONID=GOOD";
    expect(parsePastedHeaders(text).cookies["JSESSIONID"]).toBe("GOOD");
  });

  it("falls back to scraping synchronizerToken from pasted page HTML", () => {
    const text = `<html>
<meta name="synchronizerToken" content="aaaa-bbbb-cccc-dddd">
</html>`;
    expect(parsePastedHeaders(text).synchronizerToken).toBe("aaaa-bbbb-cccc-dddd");
  });

  it("prefers the explicit X-Synchronizer-Token header over a meta-tag fallback", () => {
    const text = `X-Synchronizer-Token: header-token
<meta name="synchronizerToken" content="page-token">`;
    expect(parsePastedHeaders(text).synchronizerToken).toBe("header-token");
  });
});
