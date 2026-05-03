# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev        # Vite dev server (localhost:5173)
pnpm build      # tsc -b && vite build
pnpm preview    # Preview production build
pnpm typecheck  # tsc -b --noEmit
pnpm test       # vitest --watch
pnpm test:run   # vitest run --passWithNoTests (CI-safe)
pnpm test:ui    # vitest with @vitest/ui
pnpm lint       # biome check
pnpm format     # biome format --write
pnpm fix        # biome check --write
pnpm check      # typecheck + lint + test:run + build (full CI)
```

Dev environment uses a Nix flake — run `direnv allow` or `nix develop` to enter the shell.

## Architecture

SAIT Schedule Builder is a client-side React/TypeScript SPA. It pulls
course sections from SAIT's Banner registration system and generates
non-conflicting schedule combinations ranked by quality.

The app is layered so each concern lives in exactly one place:

```
src/
  banner-sdk/       # typed Banner client (transport, session, app facades)
  domain/           # pure scheduling logic (no React, no Banner shapes)
  store/            # Zustand store with sliced state + persistence
  features/         # feature-grouped UI: auth, search, selection, rules,
                    #   schedule, current, registration, status
  hooks/            # cross-slice side-effect hooks (useAuth, useScheduleSync)
  ui/               # shared UI primitives (Popover today; more later)
  lib/              # cross-cutting plumbing (chrome extension bridge,
                    #   term constants, Banner-shape types)
  AppHeader.tsx     # shell components (sticky header, courses panel,
  CoursesPanel.tsx  #   main area, sign-in screen) — pulled in by App.tsx
  MainArea.tsx
  SignInScreen.tsx
  App.tsx           # 36-line layout shell; mounts side-effect hooks +
                    #   composes the four shell pieces
extension/
  background.ts     # service worker — credential capture + cookie mgmt
                    #   + BANNER_FETCH bridge (no Banner-app awareness)
  content.ts        # scrapes synchronizer token from Banner pages
  inject.ts         # announces extension ID to localhost / pages.dev
```

### Banner SDK (`src/banner-sdk/`)

Pluggable HTTP transport (`ExtensionTransport`, `DirectTransport`,
`MockTransport`), a `SyncTokenCache` + `RegistrationSession` that owns
the term-priming dance, and typed clients per Banner app:

  * `apps/registration/` — class search + section details (14 endpoints)
    + cart (stage / submit / batch) + active-registrations list +
    notice banner. Hits `ssag6.sait.ca/StudentRegistrationSsb/`.
  * `apps/general/` — `getBannerId` (the login-validation chokepoint),
    personal-info endpoints (10), lookup lists (9). Hits
    `ssag2.sait.ca/BannerGeneralSsb/`.
  * `apps/selfService/` — student profile (GPA, registration notices,
    registered-course list, curriculum HTML), holds count. Hits
    `ssag1.sait.ca/StudentSelfService/`.

`core/request.ts` is the single chokepoint. It branches on the verified
ssag6 status taxonomy:

  * 403 + small `{"error":"access denied"}` JSON → `BannerNotPermittedError`
    (the endpoint is gated by a fresh-SAML check XHR can't satisfy)
  * 200 + `text/html` → refresh sync token via `SyncTokenCache.refresh`
    + retry once (Banner SAML cycle landed on the XHR)
  * non-2xx → `BannerHttpError`
  * network failure → `BannerNetworkError`

The extension is a thin shim: it captures cookies + sync token and
forwards `BANNER_FETCH` messages. Session validation, retry, and term
priming all live in the SDK.

### Domain layer (`src/domain/`)

Pure types + scheduler + scorer + parser + iCal export. No React, no
Banner shapes. `parser.ts` is the seam where Banner shapes (imported
from `lib/types`) get converted to domain shapes.

Tests live in `src/domain/tests/` (vitest).

### Store (`src/store/`)

Zustand store with eight slices:

  * `auth` — credentials, studentId, gpa, registrationNotices,
    sessionExpired
  * `term` — selectedTerm
  * `courses` — courseGroups (Map<subjectCourse, CourseSection[]>),
    loadBannerResponse, clearCourses
  * `selection` — selectedCourses (Set<subjectCourse>)
  * `rules` — ScheduleRules + setRules
  * `schedules` — generated schedules + activeIndex + generationStatus
    + generate() (with the explainEmpty error helper)
  * `currentReg` — currentRegistrations, sectionOverrides,
    includedCourses, swapSection, getCurrentSchedule
  * `ui` — loadError, registrationsLoading

The SDK is constructed once per page load via `src/store/sdk.ts`'s
`getSdk()` singleton. The `auth` slice's `setCredentials` action
routes through `getSdk().connect/disconnect` so the SDK's session
cache stays in sync.

Cross-slice side effects (background revalidation poll, auto-load on
connect, debounced regenerate-on-rules-change) live in `useAuth` and
`useScheduleSync` — mounted once at the top of `App.tsx`.

### Persistence

Zustand `persist` middleware mirrors `rules`, `term`, `selectedCourses`,
`sectionOverrides`, and `includedCourses` to `localStorage` under
`sait-sb-v1`. Map and Set are serialized as arrays via `partialize`
and rebuilt via `merge`. Generated schedules + the credentials blob
+ transient UI flags are intentionally NOT persisted.

To clear local prefs: `localStorage.removeItem("sait-sb-v1")`.

### Key conventions

- **Time format**: HHMM 24-hour integers — `1400` = 2:00 PM, `800` = 8:00 AM.
- **Day abbreviations**: `Mon | Tue | Wed | Thu | Fri | Sat | Sun` (type `DayOfWeek`).
- **No routing**: single-page tab navigation, no React Router.
- **Banner host pinning**: each endpoint lives on exactly one host;
  there is no cross-host routing. The SDK encodes host-per-endpoint
  inside each app module.
- **uniqueSessionId**: generated once per SDK construction via
  `nanoid()` (was `Date.now()` in the legacy api.ts; collision-prone
  if two parallel calls primed the same term).

### Testing

`pnpm test:run` runs vitest. 48 tests today across:

  * `src/domain/tests/` — scheduler, scoring, conflicts, time, parser
  * `src/banner-sdk/tests/` — request chokepoint (retry / error
    classification), search byCourses, registration registerCrns
  * `src/features/auth/tests/parseHeaders.test.ts` — manual-paste header parser

`MockTransport` (`src/banner-sdk/transport/mock.ts`) records every
call and returns canned responses; pass it to `createBannerSdk` to
test SDK consumers without hitting the wire.
