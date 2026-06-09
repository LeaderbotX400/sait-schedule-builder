---
name: vitest-vite-patterns
description: "Vitest 4 + Vite 8 patterns for this repo — when to use createTestingPinia, jsdom vs browser mode, tsconfigPaths aliases, single config with conditional crxjs plugin, oxlint+eslint stays dual."
metadata: 
  node_type: memory
  type: reference
  originSessionId: 05df18e6-4bd0-4dd4-a4b8-439ea5176112
---

## Vitest 4

**Pinia store tests: `createPinia` + `setActivePinia` in `beforeEach`.** This is what the existing 84 tests do — keep it. Use `createTestingPinia` (from `@pinia/testing`) ONLY when mounting a Vue component that *uses* a store and you need to stub actions or spy. Mixing the two adds no value. ([pinia.vuejs.org/cookbook/testing](https://pinia.vuejs.org/cookbook/testing.html))

**Component tests: start with `@vue/test-utils` + jsdom; hold on browser mode.** Vitest 4.0 made browser mode stable ([vitest.dev/blog/vitest-4](https://vitest.dev/blog/vitest-4)) via `vitest-browser-vue`, but for this repo (no clipboard, ResizeObserver, shadow DOM in components) jsdom is accurate enough and has zero infra overhead. Switch only if you hit a jsdom fidelity wall.

**Vitest 4 breaking change:** `poolMatchGlobs` removed; migrate to `projects` if you had per-glob pool rules. Probably unaffected here. Custom-element snapshots now print shadow-root by default (`printShadowRoot: true`) — relevant only if you snapshot custom elements.

**Mocking strategy: dependency injection over `vi.mock`.** `MockTransport` passed into `createBannerSdk()` is the right pattern. `vi.mock` only when module structure doesn't support DI.

**Test layout: `src/<area>/tests/*.test.ts` is fine.** Vitest is layout-agnostic. The only practical rule: if a test would be more than 2 directories away from the code it tests, move it closer.

## Vite 8

**`resolve.tsconfigPaths: true` — enable it, declare aliases once in tsconfig.** Don't maintain `@features`, `@ui`, etc. separately in `vite.config.ts`. Set the flag, define paths in `tsconfig.json`, Vite reads them automatically. ([vite.dev/blog/announcing-vite8](https://vite.dev/blog/announcing-vite8))

**Rolldown is the headline.** Vite 8 swapped esbuild+Rollup for Rolldown (Rust). 10–30× build improvements in real projects. `@crxjs/vite-plugin@2.5.0` peer-deps cover Vite 8 — works despite [[crxjs-status]] being unmaintained.

**Dual extension + standalone web app: single config with env branching.** Established pattern ([vite.dev](https://vite.dev/)):

```ts
// vite.config.ts
export default defineConfig(({ mode }) => ({
  plugins: [
    vue(),
    tailwindcss(),
    mode === 'extension' ? crxjs({ manifest }) : null,
  ].filter(Boolean),
}))
```

`bun run build` for extension, `bun run build:web` (with `--mode web`) for standalone. Demo mode is orthogonal — gated by `import.meta.env.VITE_DEMO_MODE` regardless of build target.

**Env vars:** prefix with `VITE_` to expose to client. `.env.demo` with `VITE_DEMO_MODE=true` + `vite build --mode demo`. Read via `import.meta.env.VITE_DEMO_MODE` in `isDemoMode()`.

## Linting / formatting

**Keep oxlint + eslint dual setup.** Oxlint cannot yet replace `eslint-plugin-vue` — the March 2026 JS plugins alpha explicitly lists Vue support as "coming later this year" ([oxc.rs/blog/2026-03-11-oxlint-js-plugins-alpha](https://oxc.rs/blog/2026-03-11-oxlint-js-plugins-alpha)). The current `oxlint --fix` then `eslint --fix --cache` split is the recommended migration path. Reassess when oxlint ships stable Vue plugin support.

**eslint flat config only.** `@vue/eslint-config-typescript` supports flat config. Use the array export in `eslint.config.js`. Don't fall back to `.eslintrc` — deprecated.

Related: [[folder-structure-recommendation]], [[crxjs-status]]
