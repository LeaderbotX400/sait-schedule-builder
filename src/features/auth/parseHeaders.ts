/**
 * Parser for the manual "paste headers" auth flow.
 *
 * Input: a block of text the user pasted from
 *   DevTools → Network → any Banner request → Copy → Copy Request Headers.
 *
 * Output: the bits of credential the chrome extension can install on the
 * Banner cookie jar so the SDK can authenticate without going through the
 * full SAML popup flow.
 *
 * The function is intentionally lenient — it accepts both "Header-Name: value"
 * lines and pure URL paths containing the `uniqueSessionId` query param.
 */

export interface ParsedHeaders {
  synchronizerToken?: string;
  uniqueSessionId?: string;
  cookies: Record<string, string>;
}

// HTML meta-tag form: <meta name="synchronizerToken" content="...">
const SYNC_TOKEN_META_RE = /name=["']synchronizerToken["']\s+content=["']([a-f0-9-]{8,})["']/i;
// JS source form: synchronizerToken: "..." or synchronizerToken = "..."
const SYNC_TOKEN_JS_RE = /synchronizerToken["']?\s*[:=]\s*["']([a-f0-9-]{8,})["']/i;

export function parsePastedHeaders(text: string): ParsedHeaders {
  const out: ParsedHeaders = { cookies: {} };

  const sessionIdMatch = text.match(/uniqueSessionId=([^&\s]+)/);
  if (sessionIdMatch?.[1]) out.uniqueSessionId = sessionIdMatch[1];

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const colon = line.indexOf(":");
    if (colon <= 0) continue;
    const name = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();
    if (!value) continue;

    if (name === "x-synchronizer-token") {
      out.synchronizerToken = value;
    } else if (name === "cookie") {
      for (const pair of value.split(";")) {
        const eq = pair.indexOf("=");
        if (eq <= 0) continue;
        out.cookies[pair.slice(0, eq).trim()] = pair.slice(eq + 1).trim();
      }
    }
  }

  // Fallback: if the user pasted Banner HTML / JS rather than headers,
  // scrape the meta-tag (preferred) or any synchronizerToken assignment.
  if (!out.synchronizerToken) {
    const meta = text.match(SYNC_TOKEN_META_RE) ?? text.match(SYNC_TOKEN_JS_RE);
    if (meta?.[1]) out.synchronizerToken = meta[1];
  }

  return out;
}
