---
name: folder-structure-recommendation
description: "Recommended folder reorg — consolidate planner stores into feature modules under src/features/, matching the pattern identity/profile/holds/theme already follow. Synthesizes 2026 Vue community consensus."
metadata: 
  node_type: memory
  type: project
  originSessionId: 05df18e6-4bd0-4dd4-a4b8-439ea5176112
---

The 2026 Vue community consensus for medium-sized apps is the **feature module pattern**: each named domain owns its store + composable + components in one folder, with shared/framework-agnostic layers kept separate at the root. Sources: [Vue FAQ project structure](https://vue-faq.org/en/development/project-structure.html), [alexop.dev](https://alexop.dev/posts/how-to-structure-vue-projects/), [Vue Playbook (Wisemen)](https://wisemen-digital.github.io/vue-playbook/project-structure), [2025 enterprise guide](https://eastondev.com/blog/en/posts/dev/20251124-vue3-typescript-best-practices/).

**The current repo is hybrid and inconsistent.** Some domains follow the feature module pattern correctly (`identity/`, `profile/`, `holds/`, `theme/` — each has store + composable + index). The 7 planner stores live in `src/stores/<name>.ts` while their UI lives in `src/features/<name>/`. Same concern, split across two top-level folders.

## Proposed reorg

```
src/
  banner-sdk/             # pure TS — stays
  domain/                 # pure TS — stays
  lib/                    # extension bridge, types, SDK singleton — stays
                          # (also: move stores/persistence.ts here)
  ui/                     # shared primitives (Button, Card, Spinner, Popover) — stays
  shell/                  # layout (SignInScreen, AppShell, AppHeader, MainArea) — stays
  composables/            # cross-feature side-effect composables (useScheduleSync,
                          #   useDemoBootstrap) — stays
  demo/                   # demo-mode bootstrap — stays at top level OR move to features/demo/

  features/
    auth/                 # store.ts + service.ts + useAuth.ts + ConnectionStatus.vue
                          #   (move from src/auth/)
    identity/             # store + composable + index (move from src/identity/)
    profile/              # store + composable + GpaChip.vue (move from src/profile/)
    holds/                # store + composable (move from src/holds/)
    registration-status/  # composable only (move from src/registration-status/)
    theme/                # store + composable + theme list (move from src/theme/)
    term/                 # store.ts (from stores/term.ts) + any term-specific component
    courses/              # store.ts (from stores/courses.ts) + SearchPanel etc.
    selection/            # store.ts (from stores/selection.ts) + SelectionPanel etc.
    rules/                # store.ts (from stores/rules.ts) + RulesPanel etc.
    schedules/            # store.ts (from stores/schedules.ts) + ScheduleView etc.
    current/              # store.ts (from stores/currentReg.ts) + CurrentScheduleEditor etc.
    ui-state/             # store.ts (from stores/ui.ts) — tiny, no components

  App.vue
  main.ts
```

## Conventions

- **No barrel files.** The community is skeptical of `export *` barrels — they break tree-shaking and hide circular deps ([jsdev.space — stop using barrel files](https://jsdev.space/howto/stop-using-barrel-files/)). Either drop `index.ts` entirely and import directly, or keep a minimal `index.ts` that re-exports only the public API (no `export *`).
- **Path aliases over deep relative imports.** Vite 8 supports `resolve.tsconfigPaths: true` — declare aliases (`@features/*`, `@ui/*`, `@lib/*`, `@shell/*`) once in `tsconfig.json` and they work in both Vite and vue-tsc. ([vite.dev/blog/announcing-vite8](https://vite.dev/blog/announcing-vite8))
- **Pure layers stay top-level.** `banner-sdk/`, `domain/`, `lib/` have no Vue dependency and are reused by tests + demo. Don't bury them inside `features/`.
- **Cross-feature composables stay top-level.** `useScheduleSync` orchestrates multiple stores — no single feature owns it. `src/composables/` is the right home. The Vue Playbook + Vue FAQ both agree on this placement.
- **Layout is not a feature.** `shell/` and `ui/` stay top-level.
- **`composables/` inside a feature is fine** for feature-local composables. `useScheduleSync` is the cross-feature exception.

## Why this works for this specific repo

- The maintainability rule "one concern per place" gets enforced structurally. Today, editing the rules feature means touching `src/stores/rules.ts` AND `src/features/rules/`. After the move it's one folder.
- The pattern already works for `identity/`, `profile/`, `holds/`, `theme/`. The fix is to extend it, not invent something new.
- Pure framework-agnostic layers (`banner-sdk/`, `domain/`) stay isolated — they're the foundation of the test suite.

## Risks / gotchas before doing this

- **84 existing tests** import stores from `src/stores/<name>.ts`. The move will need every test file's imports updated. Mechanical, but big diff. Wire path aliases first so tests import from `@features/courses/store` not relative paths.
- **`store.ts` per feature** means the file name is no longer unique — IDE "go to file" by typing `store.ts` becomes ambiguous. Convention to consider: name the file `<feature>Store.ts` (`rulesStore.ts`, `coursesStore.ts`) for fast jumps.
- **Persistence wiring** (`installStorePersistence()` in `main.ts`) needs all import paths updated.

## Headline

**Move every store into its feature folder, and move every existing feature folder under `src/features/`.** Keep pure / shared / layout layers at the top. No barrel files; use Vite path aliases instead.

Related: [[vue-pinia-conventions]], [[vite-config-patterns]]
