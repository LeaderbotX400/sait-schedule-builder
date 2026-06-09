---
name: react-port-reference
description: "The React main branch at LeaderbotX400/sait-schedule-builder is the canonical port source for the `vue` branch redesign."
metadata: 
  node_type: memory
  type: reference
  originSessionId: eeabaaca-3027-4962-84c9-909ff7354281
---

**Repo:** https://github.com/LeaderbotX400/sait-schedule-builder, branch `main`.

The local `vue` branch is a full Vue 3 + Pinia rewrite of that React + Zustand source. When porting a feature, fetch the React source verbatim and port it — don't reinvent. The architecture is intentionally near-identical so cross-references stay useful.

**How to fetch verbatim source.** Use WebFetch against `https://raw.githubusercontent.com/LeaderbotX400/sait-schedule-builder/main/<path>`. If the WebFetch model summarises instead of returning code, retry with the explicit instruction: "Return verbatim source code with NO summary — paste the file contents exactly as they appear, byte for byte." Repeated retries with that phrasing usually get the raw source.

**Test inconsistencies.** `src/banner-sdk/tests/search.test.ts` in the React repo was at one point out of sync with `src/banner-sdk/apps/registration/search.ts` (arg order + return shape mismatch). The actual `search.ts` is the canonical reference — if the test contradicts it, trust the source.

**Architecture deltas already applied in the Vue port:**
- React `useEffect` → Vue `onMounted` / `onUnmounted` / `watch` / `watchEffect`
- React `useStore((s) => s.x)` selector → `storeToRefs(useXStore())` destructuring
- React `useState` for local UI state → Vue `ref` inside `<script setup>`
- React `useEffect` for cross-store side effects → Vue composable in `src/composables/`
- Zustand `persist` middleware → Pinia `$subscribe` + custom localStorage helper in `src/stores/persistence.ts`
- React `useAuth().status === "authenticated"` callback wiring → `setSessionExpiredHandler()` in `lib/sdk.ts` (avoids the cyclic dep that Zustand allowed)

**Port status (2026-06-08):** The Vue rewrite is feature-complete vs the React main — planner, auth, identity, profile, holds, registration-status, demo, theme are all ported. Use this memory only when adding a NEW feature that has an analogue in the React main and you want to crib its shape; the bulk port is done.
