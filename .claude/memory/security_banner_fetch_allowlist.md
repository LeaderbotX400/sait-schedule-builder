---
name: security-banner-fetch-allowlist
description: The SSRF allowlist in extension/bannerProxy.ts is load-bearing — never loosen it; don't hardcode the extension ID
metadata:
  type: project
---

`BANNER_FETCH`/`BANNER_PRIME` in `extension/bannerProxy.ts` fetch arbitrary URLs **with the user's live SAIT session cookies**, and the extension ID is broadcast to localhost/pages.dev pages by `inject.ts` — so any co-resident local script can call the bridge. The URL allowlist (SAIT Banner subdomains only) is what closes that SSRF class. It is implemented and must stay.

**Why:** Without the allowlist, any other dev server or malicious `*.pages.dev` page could read authenticated SAIT data via the extension (same class as the LayerX "ClaudeBleed" issue).

**How to apply:** Never loosen or remove the allowlist when touching the proxy. Don't "fix" discovery by hardcoding the extension ID — it differs between dev/prod and changes on republish; `inject.ts` auto-discovery exists for that reason. If the extension ever gets wider distribution, consider nonce-based session tokens between inject.ts and the SW, and keep `externally_connectable.matches` narrow.

Related: [[crxjs-status]]
