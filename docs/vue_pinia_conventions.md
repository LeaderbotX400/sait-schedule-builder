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
- **One concern per store.** Already the rule. The `holds/` store (just `count` + `loading`) is on the edge — keep it only if it has an independent fetch lifecycle from `currentReg`; otherwise fold its fields into the store that already fetches them. ([masteringpinia.com — best practices](https://masteringpinia.com/blog/5-best-practices-for-scalable-vuejs-state-management-with-pinia))
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

1. `useOtherStore()` inside an action or computed — idiomatic. Call before any `await`.
2. **Watchers in `src/composables/`** — for side effects that span multiple stores. Mount ONCE at App.vue root. This is the repo's established rule and matches official guidance. ([pinia.vuejs.org/cookbook/composables](https://pinia.vuejs.org/cookbook/composables.html))
3. `$onAction` — only for audit/log plugins. Not for primary wiring.
4. `$subscribe` — persistence and logging. Not for driving reactive side effects (use watchers).

## Composables vs stores

| Need | Use |
|------|-----|
| Global, persisted, plugin-visible | Store |
| Reusable logic with independent instances | Composable |
| Cross-store side effect (fetch on watch) | Composable in `src/composables/`, mounted at App.vue root |
| Thin readonly projection | Composable returning `computed()` over a source store — **no store needed** |

`registration-status/` correctly has no store — it's a projection. Keep it that way.

**Anti-pattern:** composables that call `onMounted` / `provide` / `inject` cannot be used inside a Pinia setup store. Those belong in components or root composables.

## `$subscribe` for persistence

- Called from `main.ts` (outside any component) — `detached: true` is irrelevant. Don't set it.
- `flush: 'sync'` is fine for small serialized blobs (the repo's `selectedCourses`, `sectionOverrides`). Avoid for large Maps with rapid mutation — blocks the main thread.
- `$patch()` always fires synchronously regardless of `flush`.

## Demo mode boundary

Demo branching belongs at the **SDK construction site** (`src/lib/sdk.ts` chooses `MockTransport` vs `ExtensionTransport`) and at the **credential store** (`DemoCredentialStore` vs extension-cookies). Stores themselves stay demo-agnostic — they only see the SDK and the credential store interfaces. Don't sprinkle `isDemoMode()` checks into feature stores.

Related: [[folder-structure-recommendation]], [[vue-docs-mcp]]
