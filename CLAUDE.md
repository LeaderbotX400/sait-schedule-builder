# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
bun dev          # Vite dev server (localhost:5173)
bun run build    # type-check + vite build
bun run preview  # Preview production build
bun run type-check
bun test         # vitest --watch
bun run test:run # vitest run (CI-safe, passes with no tests)
bun run test:ui  # vitest with @vitest/ui
bun run lint     # oxlint + eslint
bun run format   # oxfmt
bun run check    # type-check + lint + test:run + build (full CI)
```

Dev environment uses a Nix flake — run `direnv allow` or `nix develop` to enter the shell.

## Architecture

SAIT Schedule Builder is a client-side Vue 3 / TypeScript SPA shipped as
a chrome extension. It pulls course sections from SAIT's Banner
registration system and generates non-conflicting schedule combinations
ranked by quality.

The app is layered so each concern lives in exactly one place:

Organized as a **feature module pattern**: each named domain owns its
store + composable + components under `src/features/<name>/`. Pure /
framework-agnostic layers and cross-cutting plumbing stay at the top
level.

```
src/
  banner-sdk/       # typed Banner client (transport, session, app facades)
  domain/           # pure scheduling logic (no Vue, no Banner shapes)
  lib/              # cross-cutting plumbing — extension bridge, term
                    #   constants, Banner-shape types, SDK singleton
                    #   (lib/sdk.ts), Vue composable for extension-ID
                    #   handshake, shared $subscribe persistence helper
                    #   (lib/persistence.ts)
  demo/             # demo-mode bootstrap — isDemoMode(), fixtures, and
                    #   createDemoTransport() (a seeded MockTransport)
  composables/      # cross-feature side-effect composables
                    #   (useScheduleSync, useDemoBootstrap)
  ui/               # shared UI primitives (Button, Card, Spinner,
                    #   EmptyState, StatusDot, Popover) as Vue SFCs
  shell/            # top-level layout: SignInScreen, AppShell, AppHeader,
                    #   CoursesPanel, MainArea
  features/         # one folder per domain — store.ts + use<X>.ts +
                    #   components/tests live together:
                    #     auth/             store + service + useAuth + ConnectionStatus
                    #     identity/         studentId resolution
                    #     profile/          GPA + notices + GpaChip
                    #     holds/            holds count
                    #     registration-status/   derived composable, no store
                    #     theme/            theme store + ThemePicker
                    #     term/             active term + cascade-wipe setTerm
                    #     courses/          course catalog (Map<subjectCourse, …>)
                    #     selection/        selected courses + CourseSelector
                    #     rules/            ScheduleRules + RulesPanel + BlockoutGrid
                    #     schedules/        generated schedules + Calendar/Strip/Detail
                    #     current/          current registration editor
                    #     search/           CourseSearch component (reads courses)
                    #     ui-state/         transient loadError / loading / authRequired
  App.vue           # mounts side-effect composables + swaps between
                    #   SignInScreen and AppShell
  main.ts           # createApp + Pinia + persist*Store() calls
extension/
  background.ts     # service worker — credential capture + cookie mgmt
                    #   + BANNER_FETCH bridge (no Banner-app awareness)
  inject.ts         # announces extension ID to localhost / pages.dev
```

Convention: cross-feature and feature → top-level imports use the `@/`
alias (`@/features/<x>/store`, `@/lib/sdk`, `@/domain/types`). Within
a feature, imports stay relative (`./store`, `./useFoo`).

### Banner SDK (`src/banner-sdk/`)

Pluggable HTTP transport (`ExtensionTransport`, `MockTransport`), a
`RegistrationSession` that owns the term-priming dance, and typed
clients per Banner app:

- `apps/registration/` — class search + section details. Hits
  `ssag6.sait.ca/StudentRegistrationSsb/`.
- `apps/general/` — `getBannerId` (the login-validation chokepoint).
  Hits `ssag2.sait.ca/BannerGeneralSsb/`.
- `apps/selfService/` — student profile (GPA, registration notices,
  registered-course list, curriculum HTML), holds count. Hits
  `ssag1.sait.ca/StudentSelfService/`.

`core/request.ts` is the single chokepoint. It branches on the verified
ssag6 status taxonomy:

- 403 + small `{"error":"access denied"}` JSON → `BannerNotPermittedError`
- 200 + `text/html` → `BannerSessionExpiredError`
- non-2xx → `BannerHttpError`
- network failure → `BannerNetworkError` / `BannerAuthRequiredError`

Pure TypeScript, no Vue. The extension is a thin shim: it captures
cookies and forwards `BANNER_FETCH` messages. Session validation, retry,
and host priming all live in the SDK.

### Domain layer (`src/domain/`)

Pure types + scheduler + scorer + parser + iCal export. No Vue, no
Banner shapes. `parser.ts` is the seam where Banner shapes (imported
from `lib/types`) get converted to domain shapes.

Tests live in `src/domain/tests/` (vitest).

### Planner stores (under `src/features/<name>/store.ts`)

Seven Pinia setup-style stores, one concern each, each colocated with
its UI under `src/features/`:

- `term` — active term + picker options. `setTerm` cascades a wipe to
  every per-term store, so a subjectCourse key never leaks across terms.
- `courses` — `courseGroups: Map<subjectCourse, CourseSection[]>`,
  `loadBannerResponse`, `removeCourse`, `clearCourses`.
- `selection` — `selectedCourses: Set<subjectCourse>` driving the planner.
- `rules` — `ScheduleRules` (time bounds, blockout, weights, prefix filter).
  Survives term switches — these are real cross-term preferences.
- `schedules` — generated schedules + activeIndex + `GenerationStatus`,
  with `generate()` and the `explainEmpty` diagnostic helper.
- `current` — `currentRegistrations`, `sectionOverrides`,
  `includedCourses`, `swapSection`, `getCurrentSchedule` (store ID stays
  `"currentReg"` to preserve the localStorage key).
- `ui-state` — `loadError`, `registrationsLoading`, `authRequired`
  (transient, not persisted).

Map and Set state lives in `shallowRef` and is replaced wholesale on
mutation (`courseGroups.value = new Map(courseGroups.value); …`) — the
same immutable-update discipline the legacy Zustand store used.

### Persistence (`src/lib/persistence.ts`)

A tiny `$subscribe`-based helper. Each store exports its own
`persist<Store>Store()` function; `main.ts` calls them once after
`createPinia()`. Persisted today:

- `rules` (whole object)
- `term` (string)
- `selectedCourses` (Set → array)
- `currentReg.sectionOverrides` (Map → array) + `includedCourses` (Set → array)

Auth state has its own persistence inside `extensionCookieStore.ts`
under `sait-auth-v1` so login state survives reloads.

Generated schedules and transient UI flags are intentionally NOT
persisted. To wipe local prefs: `clearPersistedState("sait-sb-v1:")`
from `lib/persistence.ts`.

### Auth (`src/features/auth/`)

- `store.ts` — Pinia store for auth state (status, busy, lastError,
  acquiredAt, liveChecked, tick + age-derived `computed`s).
- `service.ts` — `AuthService` singleton, drives login / refresh /
  disconnect and wires `setSessionExpiredHandler` from `lib/sdk.ts`.
  Picks `DemoCredentialStore` vs `ExtensionCookieCredentialStore`
  based on `isDemoMode()`.
- `credentialStore.ts` + `extensionCookieStore.ts` + `demoStore.ts` —
  pluggable backends.
- `useAuth.ts` — component-facing composable; returns reactive refs
  + bound action callbacks.
- `useAuthInit.ts` — mounted once at the root; kicks off init + the
  60s live-check poll + the 10s age-tick + `visibilitychange` refresh.

### Profile / identity / holds (`src/features/identity/`, `src/features/profile/`, `src/features/holds/`, `src/features/registration-status/`)

Four chained modules, each shaped as `store.ts + use<Module>.ts + index.ts`:

- **`identity/`** — `studentId`, `lastError`, `validating`. `useIdentity()`
  watches `[auth.status, auth.liveChecked]` and on transition to
  authenticated fires `sdk.general.identity.validateLogin()`; clears
  on logout.
- **`profile/`** — `gpa: GpaResponse | null`,
  `registrationNotices: RegistrationNoticesResponse | null`, `loading`.
  `useProfile()` watches `identity.studentId` and fires
  `viewGPAHoursList` + `viewRegistrationNotices` concurrently. Exposes
  `GpaChip.vue` for the header badge.
- **`holds/`** — `count: number | null`, `loading`. `useHolds()` watches
  `studentId` and calls `getHoldsCount`.
- **`registration-status/`** — thin derived composable. No store, no SDK
  fetch — returns a `ComputedRef` over `profileStore.registrationNotices`.

All composables use a `runId` cancellation token + `onUnmounted` cleanup
so late SDK responses can't write into a stale store.

### Demo mode (`src/demo/`)

- `index.ts` — `isDemoMode()` (checks `?demo=1` query string and the
  `VITE_DEMO` env var) plus `DEMO_STUDENT_ID` / `DEMO_TERM` constants.
- `fixtures.ts` — canned Banner responses (terms, active registrations,
  search catalog, lookup suggestions).
- `mockBanner.ts` — `createDemoTransport()` wires those fixtures into
  a `MockTransport`.
- `composables/useDemoBootstrap.ts` — mounted at the App.vue root.
  No-op outside demo mode; in demo mode calls
  `getAuthService().login()` once on mount so the planner has data
  immediately.

The auth service and SDK singleton both branch on `isDemoMode()` to
pick demo vs real backends — switching modes requires a page reload.

### Cross-store side effects (`src/composables/`)

`useScheduleSync` mounts at the root and:

- watches `[auth.status, auth.liveChecked, term]` → fetches the term
  list + active registrations, populates the courses/term stores
- watches `[courseGroups, selectedCourses, rules]` → debounces a
  200ms auto-regenerate

Errors fall through to `ui.loadError`. `BannerAuthRequiredError` flips
`ui.authRequired` so the main area can surface a reconnect button.

`useDemoBootstrap` lives in the same directory but only fires on mount
when demo mode is active.

### Key conventions

- **Time format**: HHMM 24-hour integers — `1400` = 2:00 PM, `800` = 8:00 AM.
- **Day abbreviations**: `Mon | Tue | Wed | Thu | Fri | Sat | Sun` (type `DayOfWeek`).
- **No routing**: tab-style navigation inside `MainArea`. No `vue-router`.
- **Banner host pinning**: each endpoint lives on exactly one host;
  the SDK encodes host-per-endpoint inside each app module.
- **uniqueSessionId**: generated once per SDK construction via `nanoid()`.
- **Map/Set in stores**: always `shallowRef` + immutable replacement.
  Never mutate in place.
- **Composables over hooks**: any side effect that crosses stores
  goes in `src/composables/`. Mount once at the App.vue root, never
  inside a feature component.

### Testing

`bun run test:run` runs vitest. 88 tests today across 15 files. Tests
live in a `tests/` subfolder of the module they cover:

- `src/domain/tests/` — scheduler, scoring, conflicts, time, parser
- `src/banner-sdk/tests/` — request chokepoint (errors / classification),
  search byCourses, registration listActive, selfService priming
- `src/features/term/tests/`, `courses/tests/`, `schedules/tests/`,
  `current/tests/` — store-level tests for each planner concern
- `src/features/auth/tests/` — AuthService init / login / reauth /
  disconnect / notifySessionExpired + subscribe propagation
- `src/features/identity/tests/` — useIdentity composable

`MockTransport` (`src/banner-sdk/transport/mock.ts`) records every call
and returns canned responses; pass it to `createBannerSdk` to test SDK
consumers without hitting the wire.
