---
name: vue-pinia-conventions
description: "Vue 3.5 + Pinia 3 conventions this repo follows — setup stores, shallowRef discipline, composables-at-root, storeToRefs, acceptHMRUpdate. Cites official docs."
metadata: 
  node_type: memory
  type: project
  originSessionId: 05df18e6-4bd0-4dd4-a4b8-439ea5176112
---

The repo is Vue 3.5 + Pinia 3 with strict maintainability discipline. These are the rules that align with the official docs and that the repo already enforces (or should).

## Stores

- **Setup-style only.** `defineStore('name', () => { ... })` with refs/computeds/functions. Options-style stores are inferior for TS and can't call composables. ([pinia.vuejs.org/core-concepts](https://pinia.vuejs.org/core-concepts/))
- **Return all reactive state from the setup function.** Anything not returned is invisible to DevTools, persistence plugins, and SSR.
- **One concern per store.** Already the rule (10 stores post-rewrite). ([masteringpinia.com — best practices](https://masteringpinia.com/blog/5-best-practices-for-scalable-vuejs-state-management-with-pinia))
- **Stores never call other stores' actions.** Cross-store workflows are named awaitable functions in `features/planner/actions.ts`. Reads via parameters where practical (`current/store.ts` takes the catalog as an argument).
- **`acceptHMRUpdate` on every store file.** Missing today on some stores. Add:
  ```ts
  if (import.meta.hot) import.meta.hot.accept(acceptHMRUpdate(useFooStore, import.meta.hot))
  ```
  Without it, every store edit triggers a full page reload, losing dev state. ([pinia.vuejs.org/cookbook/hot-module-replacement](https://pinia.vuejs.org/cookbook/hot-module-replacement.html))

## Reactivity

- **`shallowRef` + immutable replacement for Map/Set.** Canonical in Vue 3.5. `courseGroups.value = new Map(courseGroups.value); newMap.set(...)`. Endorsed by Vue's perf docs ([vuejs.org/guide/best-practices/performance](https://vuejs.org/guide/best-practices/performance)).
- **`storeToRefs()` preserves shallow semantics.** It wraps each property in a ref pointing to the store's underlying signal — a `shallowRef` stays shallow. The pattern is right; don't switch to deep `ref` to "fix" reactivity. ([github.com/vuejs/pinia/discussions/2343](https://github.com/vuejs/pinia/discussions/2343))
- **Never destructure a store without `storeToRefs`.** `const { count } = useStore()` silently loses reactivity. Always `const { count } = storeToRefs(useStore())`. Actions can be destructured directly (they're stable references).
- **Never use `reactive()` for state that gets wholesale replaced** — the proxy identity breaks on reassignment. Use `ref()` or `shallowRef()`.

## Cross-store communication (in preference order)

1. **Planner actions** (`features/planner/actions.ts`) — ALL multi-store mutations. Explicit, awaitable, testable.
2. **Watchers in `src/composables/`** — thin wiring from reactive sources to planner actions. Mount ONCE at App.vue root. ([pinia.vuejs.org/cookbook/composables](https://pinia.vuejs.org/cookbook/composables.html))
3. `$onAction` — only for audit/log plugins. Not for primary wiring.
4. `$subscribe` — persistence (the plugin) and logging only.

## Composables vs stores

| Need | Use |
|------|-----|
| Global, persisted, plugin-visible | Store |
| Reusable logic with independent instances | Composable |
| Cross-store side effect (fetch on watch) | Watcher in `src/composables/` calling a planner action |
| Thin readonly projection | Composable returning `computed()` over a source store — **no store needed** |
| Cancellable fetch | `useAsyncTask` (`src/composables/useAsyncTask.ts`) — never hand-roll runId counters |

**Anti-pattern:** composables that call `onMounted` / `provide` / `inject` cannot be used inside a Pinia setup store. Those belong in components or root composables.

## Persistence

One Pinia plugin (`src/plugins/persistence.ts`); stores opt in with a declarative `persist: { key, version, pick, apply }` in their `defineStore` options. Versioned `{ v, data }` envelopes under `sait-sb-v2:*`; legacy shapes live only in `plugins/migrateLegacy.ts`. Don't add per-store `persist*Store()` functions or raw `$subscribe` persistence — that pattern was retired in the 2026-06 rewrite.

**Plugins only run once pinia is installed into an app** — tests need `createApp({}).use(pinia)`.

## Reactive proxies at clone boundaries

Pinia store reads return Vue reactive proxies. Anything crossing a structured-clone boundary (Worker `postMessage`) must be unwrapped with `toRaw` first — see `toClonableInput` in `features/schedules/executor.ts`.

Related: [[vue-docs-mcp]]
