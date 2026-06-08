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

```
src/
  banner-sdk/       # typed Banner client (transport, session, app facades)
  domain/           # pure scheduling logic (no Vue, no Banner shapes)
  lib/              # cross-cutting plumbing — extension bridge, term
                    #   constants, Banner-shape types, SDK singleton
                    #   (lib/sdk.ts), Vue composable for extension-ID
                    #   handshake
  auth/             # auth Pinia store + service + composable + credential
                    #   stores (extension cookies today)
  stores/           # Pinia stores: term, selection, rules, ui, courses,
                    #   currentReg, schedules. One store per concern;
                    #   persistence wired via shared `$subscribe` helper.
  composables/      # cross-store side-effect composables
                    #   (useScheduleSync today)
  ui/               # shared UI primitives (Button, Card, Spinner,
                    #   EmptyState, StatusDot, Popover) as Vue SFCs
  shell/            # top-level layout: SignInScreen, AppShell,
                    #   AppHeader (later: CoursesPanel, MainArea)
  features/         # feature-grouped components: search, selection,
                    #   rules, schedule, current, auth, theme (lands
                    #   in upcoming waves)
  App.vue           # mounts side-effect composables + swaps between
                    #   SignInScreen and AppShell
  main.ts           # createApp + Pinia + persistence
extension/
  background.ts     # service worker — credential capture + cookie mgmt
                    #   + BANNER_FETCH bridge (no Banner-app awareness)
  inject.ts         # announces extension ID to localhost / pages.dev
```

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

### Stores (`src/stores/`)

Seven Pinia setup-style stores, one concern each:

- `term` — active term + picker options. `setTerm` cascades a wipe to
  every per-term store, so a subjectCourse key never leaks across terms.
- `courses` — `courseGroups: Map<subjectCourse, CourseSection[]>`,
  `loadBannerResponse`, `removeCourse`, `clearCourses`.
- `selection` — `selectedCourses: Set<subjectCourse>` driving the planner.
- `rules` — `ScheduleRules` (time bounds, blockout, weights, prefix filter).
  Survives term switches — these are real cross-term preferences.
- `schedules` — generated schedules + activeIndex + `GenerationStatus`,
  with `generate()` and the `explainEmpty` diagnostic helper.
- `currentReg` — `currentRegistrations`, `sectionOverrides`,
  `includedCourses`, `swapSection`, `getCurrentSchedule`.
- `ui` — `loadError`, `registrationsLoading`, `authRequired` (transient,
  not persisted).

Map and Set state lives in `shallowRef` and is replaced wholesale on
mutation (`courseGroups.value = new Map(courseGroups.value); …`) — the
same immutable-update discipline the legacy Zustand store used. The
auth store is separate, under `src/auth/store.ts`, since it pairs with
the auth service singleton.

### Persistence (`src/stores/persistence.ts`)

A tiny `$subscribe`-based helper. Each store opts in via
`persist<Store>Store()` (called from `installStorePersistence()` in
`main.ts`). Persisted today:

- `rules` (whole object)
- `term` (string)
- `selectedCourses` (Set → array)
- `currentReg.sectionOverrides` (Map → array) + `includedCourses` (Set → array)

Auth state has its own persistence inside `extensionCookieStore.ts`
under `sait-auth-v1` so login state survives reloads.

Generated schedules and transient UI flags are intentionally NOT
persisted. To wipe local prefs: `clearPersistedState("sait-sb-v1:")`
from `stores/persistence.ts`.

### Auth (`src/auth/`)

- `store.ts` — Pinia store for auth state (status, busy, lastError,
  acquiredAt, liveChecked, tick + age-derived `computed`s).
- `service.ts` — `AuthService` singleton, drives login / refresh /
  disconnect and wires `setSessionExpiredHandler` from `lib/sdk.ts`.
- `credentialStore.ts` + `extensionCookieStore.ts` — pluggable backend.
- `useAuth.ts` — component-facing composable; returns reactive refs
  + bound action callbacks.
- `useAuthInit.ts` — mounted once at the root; kicks off init + the
  60s live-check poll + the 10s age-tick + `visibilitychange` refresh.

### Cross-store side effects (`src/composables/`)

`useScheduleSync` mounts at the root and:

- watches `[auth.status, auth.liveChecked, term]` → fetches the term
  list + active registrations, populates the courses/term stores
- watches `[courseGroups, selectedCourses, rules]` → debounces a
  200ms auto-regenerate

Errors fall through to `ui.loadError`. `BannerAuthRequiredError` flips
`ui.authRequired` so the main area can surface a reconnect button.

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

`bun run test:run` runs vitest. 65 tests today across:

- `src/domain/tests/` — scheduler, scoring, conflicts, time, parser
- `src/banner-sdk/tests/` — request chokepoint (errors / classification),
  search byCourses, registration listActive, selfService priming

`MockTransport` (`src/banner-sdk/transport/mock.ts`) records every call
and returns canned responses; pass it to `createBannerSdk` to test SDK
consumers without hitting the wire.
