---
name: vue-docs-mcp
description: "Use the vue-docs MCP to validate Vue / Pinia / VueUse / Vitest / Vite patterns. Per Eric's explicit instruction. Server is unreliable — fall back gracefully."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: eeabaaca-3027-4962-84c9-909ff7354281
---

Eric called this out directly: "Make sure to use the vue-docs mcp to validate what you're doing or to look up functionality."

**Activation step.** At the start of a Vue session, call `mcp__vue-docs__set_framework_preferences` to enable the relevant subset — at minimum `pinia`, `vueuse`, `vitest`, `vite`, `vue_router`. Without this only Vue.js itself is active.

**Reliability (as of 2026-06-08).**
- `*_api_lookup` tools (e.g. `pinia_api_lookup("defineStore")`, `vue_api_lookup("computed")`) work consistently — type + page + related-APIs.
- `*_docs_search` and `ecosystem_search` have thrown `Internal error` on every prose query I tried.
- The entire MCP server has also disconnected mid-session (the deferred tools simply vanish from the deferred list). When that happens, don't retry — switch to WebFetch against `https://vuejs.org/`, `https://pinia.vuejs.org/`, `https://vueuse.org/`, `https://vitest.dev/`, `https://vite.dev/` and `https://router.vuejs.org/`.

**Why:** Validates syntax + patterns before writing 100+ lines, especially anything that's changed across major Vue/Pinia versions. Eric flagged it as a hard requirement — skipping it counts as ignoring direct guidance.

**How to apply:** Activate at session start. Use `*_api_lookup` for known names. If `docs_search` errors or the server disconnects, switch to WebFetch on the official docs URLs above — don't block on flaky MCP.
