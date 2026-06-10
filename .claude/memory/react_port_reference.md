---
name: react-port-reference
description: The original React app at LeaderbotX400/sait-schedule-builder (main) — historical port source; this repo has since diverged significantly
metadata:
  type: reference
---

**Repo:** https://github.com/LeaderbotX400/sait-schedule-builder, branch `main` — the React + Zustand app this Vue rewrite was ported from. The port completed 2026-06-08 and the Vue app has since diverged well beyond it (planner cross-store actions, typed bridge protocol, shared WeekGrid, persistence plugin; identity/profile/holds features were folded or dropped).

**How to apply:** Only consult it when adding a brand-new feature that has a React analogue worth cribbing — don't treat it as authoritative for current architecture. To fetch verbatim source, WebFetch `https://raw.githubusercontent.com/LeaderbotX400/sait-schedule-builder/main/<path>`; if the fetch model summarizes, retry with "Return verbatim source code with NO summary." Its `banner-sdk/tests/search.test.ts` was out of sync with `search.ts` — trust the source file over its tests.
