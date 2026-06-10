# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
bun dev          # Vite dev server (localhost:5173)
bun run build    # type-check + vite build
bun run preview  # Preview production build
bun run type-check
bun test         # vitest --watch
bun test src/path/to/test.ts  # run a single test file
bun run test:run # vitest run (CI-safe, passes with no tests)
bun run test:ui  # vitest with @vitest/ui
bun run lint     # oxlint + eslint
bun run format   # oxfmt
bun run check    # type-check + lint + test:run + build (full CI)
```

Dev environment uses a Nix flake — run `direnv allow` or `nix develop` to enter the shell.

## Architecture

SAIT Schedule Builder is a client-side Vue 3 / TypeScript SPA shipped as
a chrome extension (CRXJS, MV3). It pulls course sections from SAIT's
Banner registration system and generates non-conflicting schedule
combinations ranked by quality. UI primitives are built on Reka UI
(headless) styled with Tailwind 4 theme tokens.

Layered so each concern lives in exactly one place. Pure /
framework-agnostic layers stay at the top level; each app domain owns
its store + components under `src/features/<name>/`.

```
src/
  banner-sdk/       # typed Banner client (transport, session, app facades)
                    #   — the FROZEN wire contract; see below
  domain/           # pure scheduling logic (no Vue, no Banner shapes):
                    #   scheduler, scoring, conflicts, time, parser,
                    #   blockout, explain (empty-result diagnosis), iCal
  lib/              # cross-cutting plumbing:
                    #   logger.ts, terms.ts, types.ts (Banner shapes)
                    #   sdk.ts          — SDK singleton (plain factory +
                    #                     setSdkErrorHandler via hooks.onError)
                    #   termSlots.ts    — createTermSlots<T>() per-term slot factory
                    #   extensionId.ts  — extension-ID resolution + handshake
                    #   bridge/         — the app↔extension protocol:
                    #     protocol.ts   — message types + createBridgeRouter
                    #                     (imported by BOTH the app and
                    #                     extension/background.ts)
                    #     client.ts     — sendBridgeMessage / openBridgePort
  plugins/          # persistence.ts — the ONE Pinia persistence plugin
                    #   (declarative `persist` spec per store + codecs)
                    # migrateLegacy.ts — one-shot legacy-key translation
  composables/      # useAsyncTask.ts — latest-wins async primitive
                    # useScheduleSync.ts — mount-once watcher wiring
                    # useExtensionIdListener.ts
  ui/               # shared presentational kit — HARD RULE: no store imports
                    #   Button/Card/Spinner/StatusDot/EmptyState (hand-rolled)
                    #   Popover/Select (Reka wrappers)
                    #   course/    — shared course/section label formatting
                    #   week-grid/ — useWeekGridLayout + WeekGrid chrome
  shell/            # layout: SignInScreen, AppShell, AppHeader,
                    #   CoursesPanel, MainArea
  features/         # one folder per domain — store + components + tests:
                    #   auth/      store (incl. studentId) + service +
                    #              credential stores + useAuth/useAuthInit +
                    #              ConnectionStatus + ExtensionIdSettings
                    #   term/      pure term state + TermPicker (Reka Select)
                    #   catalog/   per-term course groups
                    #   selection/ per-term selected courses + pinned CRNs
                    #              + CourseSelector
                    #   rules/     ScheduleRules + RulesPanel + BlockoutEditor
                    #   schedules/ results + executor (Web Worker) +
                    #              CalendarGrid/Strip/Detail/LockedSectionsBanner
                    #   current/   current-registration slots + editor
                    #   saved/     saved picks (pure CRUD) + list
                    #   search/    CourseSearch component
                    #   planner/   NO store — cross-store workflow actions
                    #   theme/     theme store + ThemePicker
                    #   ui-state/  transient loadError/loading/authRequired
  App.vue           # mounts root composables + swaps SignInScreen/AppShell
  main.ts           # createApp + pinia.use(createPersistencePlugin()) + mount
extension/
  background.ts     # MV3 service worker — typed router over lib/bridge/protocol
  bannerProxy.ts    # BANNER_FETCH/PRIME with SSRF allowlist
  cookies.ts        # CHECK_LOGIN / CLEAR_SESSION
  login.ts          # port-based SAML login flow (keeps the SW alive)
  inject.ts         # announces extension ID to localhost / pages.dev
```

Convention: cross-feature and feature → top-level imports use the `@/`
alias. Within a feature, imports stay relative. No barrel files — the
only `index.ts` is `banner-sdk/index.ts` (part of the SDK facade).

### Banner SDK (`src/banner-sdk/`) — FROZEN WIRE CONTRACT

All inputs/outputs to/from the Banner API must stay identical: hosts,
endpoints, request shapes, response handling, error taxonomy, and the
public facade. Internal refactors are fine; wire changes are not. The
tests in `src/banner-sdk/tests/` are the contract pin.

Pluggable HTTP transport (`ExtensionTransport`, `MockTransport`), a
`RegistrationSession` that owns the 4-call term-priming dance, and typed
clients per Banner app:

- `apps/registration/` — class search + terms + lookups + listActive
  (ssag6 `StudentRegistrationSsb`)
- `apps/general/` — `validateLogin` / getBannerId, the login-validation
  chokepoint (ssag2 `BannerGeneralSsb`)
- `apps/selfService/` — student profile + holds (ssag1
  `StudentSelfService`); kept intact even though the app no longer
  consumes GPA/holds

`core/request.ts` is the single chokepoint: `classifyRawResponse` owns
the verified status taxonomy —

- 403 + small `{"error":"access denied"}` JSON → `BannerNotPermittedError`
- network failure (status 0) → `BannerAuthRequiredError`; other transport
  errors → `BannerNetworkError`
- non-2xx → `BannerHttpError`
- 200 + `text/html` → `BannerSessionExpiredError`

`BannerSdkOptions.hooks.onError` (additive) fires from the chokepoint on
every classified failure — `lib/sdk.ts` wires it to the auth service so
session expiry flips auth state globally (no Proxy wrapping).

### Stores (10) and the planner orchestration

**Hard rule: stores never call other stores' actions.** Every
multi-store mutation is a named, awaitable function in
`src/features/planner/actions.ts`:

- `switchTerm(code)` — THE term cascade: set term, clear derived
  schedules, reset transient UI, `await syncActiveTerm()`. Only
  TermPicker and `loadSavedSchedule` call it.
- `addSearchResults` / `removeCourse` / `clearTermData` — catalog +
  selection + current + schedules in one place.
- `swapSection` / `getCurrentSchedule` — inject the catalog into the
  current store's methods.
- `loadSavedSchedule` — switch term → byCourses → rehydrate →
  `await generate()` → best-match seek (no setTimeout hacks).
- `syncActiveTerm` — latest-wins Banner sync with one explicit retry
  (Banner term-prime lag); revalidates persisted future-term slots.

Per-term stores (`catalog`, `selection`, `current`, `saved`) are thin
CRUD over `createTermSlots<T>()` (`lib/termSlots.ts`): Map-in-shallowRef
with immutable replacement and a reference-stable empty active slot.
Switching terms swaps the visible slot — nothing is wiped.

`schedules.generate(input)` is async + latest-wins, takes explicit
inputs (selected catalog slice, rules, pins), and runs through a
pluggable executor: a module Web Worker in the app
(`features/schedules/generate.worker.ts`), `syncExecutor` in tests and
as automatic fallback.

`rules` survives term switches (cross-term preferences). `ui-state` is
transient. `auth` includes `studentId` (resolved via `validateLogin` by
`useAuthInit`, the old identity feature folded in).

### Persistence (`src/plugins/persistence.ts`)

One Pinia plugin. Stores declare `persist: { key, version, pick, apply }`
in their `defineStore` options; values are versioned envelopes
`{ v, data }` under `sait-sb-v2:<key>`. Codec toolbox (`codecs.stringSet
/ stringMap / termSlots / json`) handles Map/Set shapes; corrupt data
skips hydration. Persisted: term, rules, selection (incl. pins),
current overrides+included, saved, theme.

`plugins/migrateLegacy.ts` is the only file that knows pre-v2 shapes —
it translates every legacy key (sait-sb-v1:*, pre-slot v0 keys, raw
sait-sb-theme) once at plugin install and deletes the originals. Auth
state persists separately under `sait-auth-v1` inside
`extensionCookieStore`.

To wipe local prefs: `clearPersistedState()` from `plugins/persistence.ts`.

### Async + side effects

- `composables/useAsyncTask.ts` — the one latest-wins async primitive
  (watch/enabled gating, retry, AbortSignal, scope-dispose cancel).
  Any composable doing cancellable fetches uses it.
- `composables/useScheduleSync.ts` — mount-once: `[auth.status,
  auth.liveChecked]` → `syncActiveTerm`; `watchDebounced` (200ms) over
  `[catalog, selection, rules]` → `regenerate()`.
- `features/auth/useAuthInit.ts` — mount-once: service init, 60s
  live-check poll, 10s age tick, visibility refresh, studentId task.

### Extension bridge (`src/lib/bridge/` + `extension/`)

`protocol.ts` is the single source of truth for message names + payload
types (`PING`, `CHECK_LOGIN`, `CLEAR_SESSION`, `BANNER_FETCH`,
`BANNER_PRIME`, login ports, `LOGIN_STATE_CHANGED`). The wire values are
frozen (installed extensions may be older than the deployed app); only
typing improves. `createBridgeRouter` builds the SW listener;
`sendBridgeMessage`/`openBridgePort` are the app side. The SW keeps all
`chrome.*` listener registrations synchronous at `background.ts` top
level (MV3 requirement) and the SSRF allowlist in `bannerProxy.ts`.

### Key conventions

- **Time format**: HHMM 24-hour integers — `1400` = 2:00 PM.
- **Day abbreviations**: `Mon | Tue | Wed | Thu | Fri | Sat | Sun`.
- **No routing**: tab-style navigation inside `MainArea`.
- **Banner host pinning**: each endpoint lives on exactly one host.
- **Map/Set in stores**: `shallowRef` + immutable replacement, via
  `createTermSlots` — never mutate in place.
- **`src/ui/` never imports stores** — that's what keeps WeekGrid and
  the course formatters shareable.
- **Week-grid layout math lives only in `ui/week-grid/`** — both
  CalendarGrid and BlockoutEditor consume it.
- **Composables over hooks**: cross-store side effects go in
  `src/composables/`, mounted once at the App.vue root.

### Testing

`bun run test:run` runs vitest. Tests live in a `tests/` subfolder of
the module they cover:

- `src/domain/tests/` — scheduler, scoring, conflicts, time, parser
- `src/banner-sdk/tests/` — request chokepoint, hooks, search byCourses,
  registration listActive, selfService priming — the SDK contract pin
- `src/lib/tests/` (termSlots), `src/lib/bridge/tests/` (router),
  `src/composables/tests/` (useAsyncTask),
  `src/plugins/tests/` (persistence + legacy migration fixtures),
  `src/ui/week-grid/tests/`, `src/ui/course/tests/`
- `src/features/*/tests/` — planner actions (term cascade, saved
  best-match), catalog/schedules/current stores, auth service +
  useAuthInit (studentId fold)

`MockTransport` (`src/banner-sdk/transport/mock.ts`) records every call
and returns canned responses; pass it to `createBannerSdk` to test SDK
consumers without hitting the wire. Note: function handlers receive a
`RecordedCall` (use `call.url`).
