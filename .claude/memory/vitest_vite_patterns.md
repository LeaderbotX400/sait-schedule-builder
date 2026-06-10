---
name: vitest-vite-patterns
description: Vitest 4 + Vite 8 patterns for this repo — createTestingPinia boundary, jsdom over browser mode, DI over vi.mock, oxlint+eslint stays dual
metadata:
  type: reference
---

## Vitest 4

**Pinia store tests: `createPinia` + `setActivePinia` in `beforeEach`.** This is what the existing tests do — keep it. Use `createTestingPinia` (from `@pinia/testing`) ONLY when mounting a Vue component that *uses* a store and you need to stub actions or spy. Mixing the two adds no value. ([pinia.vuejs.org/cookbook/testing](https://pinia.vuejs.org/cookbook/testing.html))

**Component tests: `@vue/test-utils` + jsdom; hold on browser mode.** Vitest 4 browser mode is stable ([vitest.dev/blog/vitest-4](https://vitest.dev/blog/vitest-4)) but for this repo (no clipboard, ResizeObserver, shadow DOM in components) jsdom is accurate enough with zero infra overhead. Switch only on a real jsdom fidelity wall.

**Mocking strategy: dependency injection over `vi.mock`.** `MockTransport` passed into `createBannerSdk()` is the right pattern. `vi.mock` only when module structure doesn't support DI.

## Vite 8

- Rolldown replaced esbuild+Rollup; `@crxjs/vite-plugin@2.5.0` works with it despite [[crxjs-status]] (unmaintained).
- The repo uses a single manual `@/` alias in `vite.config.ts` (mirrored in tsconfig) — don't introduce extra per-layer aliases or switch to `resolve.tsconfigPaths` without reason.

## Linting / formatting

**Keep the oxlint + eslint dual setup.** Oxlint cannot yet replace `eslint-plugin-vue` — the March 2026 JS plugins alpha lists Vue support as "coming later this year" ([oxc.rs/blog/2026-03-11-oxlint-js-plugins-alpha](https://oxc.rs/blog/2026-03-11-oxlint-js-plugins-alpha)). Reassess when oxlint ships stable Vue plugin support. eslint is flat-config only (`eslint.config.js`).

Related: [[crxjs-status]], [[vue-pinia-conventions]]
