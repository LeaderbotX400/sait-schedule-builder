# Onboarding — SAIT Schedule Builder

A field guide to the codebase: what it is, how it's wired, where things
live, and how to make the common kinds of change without breaking the
layering. Read this once top-to-bottom, then keep it open as a map.

> If anything here disagrees with the code, the code wins — and please
> fix this doc. The canonical short-form reference is [CLAUDE.md](../CLAUDE.md);
> this guide is the long-form companion.

---

## 1. What the app is

SAIT Schedule Builder is a **client-side Vue 3 + TypeScript SPA shipped as
a Chrome (MV3) extension**. It logs into SAIT's Banner registration system,
pulls the course catalog for a term, and generates every non-conflicting
schedule combination, ranked by a quality score you can tune with rules
(time bounds, day blockouts, weighting).

There is **no backend of our own**. All data comes from Banner over the
user's authenticated session; all computation (conflict detection,
schedule generation, scoring) happens in the browser.

Two runtime shapes share one codebase:

| Context | How it loads | How it reaches Banner |
|---|---|---|
| **In-extension** | `chrome-extension://<id>/index.html` | `chrome.runtime.sendMessage(msg)` → background worker |
| **Web (dev / pages.dev)** | `localhost:5173` or `*.sait-scheduler.pages.dev` | `chrome.runtime.sendMessage(extId, msg)` — extension ID supplied explicitly, origin authorized by `externally_connectable` |
| **Demo** | either, with `?demo=1` or `VITE_DEMO` | no network — seeded `MockTransport` |

---

## 2. First run

```bash
direnv allow        # or: nix develop  (devenv flake provides the toolchain)
bun install
bun dev             # Vite dev server on http://localhost:5173
```

Other commands you'll use constantly:

```bash
bun run type-check  # vue-tsc --build
bun run test        # vitest --watch
bun run test:run    # vitest run (CI-safe, --passWithNoTests)
bun run lint        # oxlint --fix  then  eslint --fix
bun run format      # oxfmt
bun run build       # type-check + vite build → dist/  (loadable unpacked extension)
bun run check       # the full CI gate: type-check + lint + test:run + build
```

**Run `bun run check` before you call anything done.** It is exactly the
CI gate.

### Loading the extension locally

1. `bun run build` → produces `dist/`.
2. Chrome → `chrome://extensions` → enable Developer mode → *Load unpacked*
   → pick `dist/`.
3. For the **web** dev flow (`bun dev` on 5173), the page needs the
   extension's ID. The content script ([extension/inject.ts](../extension/inject.ts))
   announces it to localhost/pages.dev automatically; if that fails you can
   paste the ID via the in-app settings ([ExtensionIdSettings.vue](../src/features/auth/ExtensionIdSettings.vue)).

### Demo mode (no SAIT account needed)

Append `?demo=1` to the URL (or set `VITE_DEMO`). Auth, identity, profile,
and catalog all resolve from fixtures — see §8. Switching in/out of demo
requires a page reload.

---

## 3. The layering (the one rule that matters)

Each concern lives in **exactly one layer**, and dependencies point
**downward only**. Memorize this gradient — almost every review comment
is "this belongs one layer down/up."

```
  ┌─────────────────────────────────────────────────────────┐
  │ shell/  +  features/<x>/*.vue        UI (Vue SFCs)        │  knows Vue, knows stores
  ├─────────────────────────────────────────────────────────┤
  │ features/<x>/use<X>.ts               composables          │  per-feature side effects
  │ composables/                         cross-feature glue   │  mounted once at root
  ├─────────────────────────────────────────────────────────┤
  │ features/<x>/store.ts                Pinia stores         │  reactive state, no SDK calls*
  ├─────────────────────────────────────────────────────────┤
  │ lib/                                 plumbing             │  bridge, SDK singleton, persistence, types
  ├─────────────────────────────────────────────────────────┤
  │ banner-sdk/                          typed Banner client  │  no Vue
  │ domain/                              pure scheduling      │  no Vue, no Banner shapes
  └─────────────────────────────────────────────────────────┘
```

\* Stores hold state and synchronous mutations. **SDK fetches live in
composables**, not stores — composables call the SDK, then write results
into the store. `schedules/store.ts` is the one store that calls into the
pure `domain/` scheduler (synchronous, no I/O), which is fine.

Two layers are **pure** and have **zero framework imports**:

- **`domain/`** — types, scheduler, scorer, conflict detection, time math,
  iCal export. No Vue, no Banner. Unit-testable in isolation.
- **`banner-sdk/`** — typed Banner HTTP client. No Vue. Pluggable transport.

The seam between Banner shapes and domain shapes is [src/domain/parser.ts](../src/domain/parser.ts).
Banner JSON → `CourseSection` happens there and **only** there.

### Import conventions

- Cross-feature or feature→top-level: use the `@/` alias
  (`@/features/courses/store`, `@/lib/sdk`, `@/domain/types`).
- **Within** a feature: relative (`./store`, `./useFoo`).

---

## 4. Directory map

```
src/
  banner-sdk/        # typed Banner client (see §6)
    apps/            #   one folder per Banner app: general / registration / selfService
    core/            #   request chokepoint, session priming, forms/headers/json, host primer
    transport/       #   ExtensionTransport (real) + MockTransport (tests/demo) + errors
    config/hosts.ts  #   host-per-endpoint pinning (ssag1/2/6)
    facade.ts        #   createBannerSdk() — wires transports + apps together
    index.ts         #   public barrel
  domain/            # pure scheduling logic (see §5)
    types.ts         #   CourseSection, Schedule, ScheduleRules, MeetingBlock, warnings…
    scheduler.ts     #   generate combinations, prune conflicts, build Schedule[]
    scoring.ts       #   quality score (penalties + clustering bonuses + blockout fit)
    conflicts.ts     #   time-overlap detection
    blockout.ts      #   blockout grid + DEFAULT_RULES
    time.ts          #   HHMM ⇄ minutes, formatting
    ical.ts          #   .ics export
    parser.ts        #   Banner shapes → domain shapes  (THE seam)
  lib/               # cross-cutting plumbing
    sdk.ts           #   getSdk() singleton — picks demo vs extension transport
    extension.ts     #   BANNER_FETCH bridge to the service worker
    extensionId.ts / extensionIdListener.ts   #   ext-ID handshake (web context)
    persistence.ts   #   $subscribe-based localStorage helper
    terms.ts         #   term constants + mergeTermOptions
    types.ts         #   Banner-shape types (still here; migrating into banner-sdk/apps/*/types)
    logger.ts
  composables/       # cross-feature side effects, mounted once at App root
    useScheduleSync.ts   #   the spine — fetch on auth/term change, debounce auto-regenerate
    useDemoBootstrap.ts  #   no-op unless demo mode
  demo/              # demo bootstrap: isDemoMode(), fixtures, createDemoTransport()
  ui/                # shared primitives: Button, Card, Spinner, EmptyState, StatusDot, Popover
  shell/             # top-level layout: SignInScreen, AppShell, AppHeader, CoursesPanel, MainArea
  features/          # one folder per domain — store + use<X> + components + tests colocated
  App.vue            # mounts all side-effect composables; swaps SignInScreen ⇄ AppShell
  main.ts            # createApp + Pinia + persist*Store() calls + mount
extension/
  background.ts      # MV3 service worker: credential capture, cookie mgmt, BANNER_FETCH proxy
  inject.ts          # content script: announces extension ID to localhost / pages.dev
```

### The feature modules

Each lives under `src/features/<name>/` and (mostly) follows
`store.ts` + `use<Name>.ts` + `index.ts` + `components` + `tests/`.

| Feature | Owns | Notes |
|---|---|---|
| `auth/` | login state, `AuthService` singleton, pluggable credential stores | most complex feature — see §7 |
| `identity/` | `studentId` resolution | validates login on auth transition |
| `profile/` | GPA + registration notices | `GpaChip.vue` header badge |
| `holds/` | holds count | |
| `registration-status/` | derived status | **no store, no fetch** — computed over profile |
| `theme/` | theme selection | `data-theme` + Tailwind layers |
| `term/` | active term + picker options | `setTerm` **cascade-wipes** every per-term store |
| `courses/` | `courseGroups: Map<subjectCourse, CourseSection[]>` | the catalog |
| `selection/` | `selectedCourses: Set<subjectCourse>` | what the planner plans for |
| `rules/` | `ScheduleRules` | **survives** term switches (real prefs) |
| `schedules/` | generated `Schedule[]`, activeIndex, `generate()`, `explainEmpty` | calls `domain/` |
| `current/` | current Banner registration editor | store id stays `"currentReg"` for the localStorage key |
| `ui-state/` | `loadError`, `registrationsLoading`, `authRequired` | transient, **not** persisted |
| `search/` | `CourseSearch.vue` | reads courses, no store |

---

## 5. Domain layer — how a schedule gets built

This is the heart, and it's pure functions you can test without a browser.

1. **Input**: the set of selected `subjectCourse`s, each mapping to a list
   of `CourseSection`s (from `courses/store`), plus the current
   `ScheduleRules` (from `rules/store`).
2. **Filter** ([scheduler.ts](../src/domain/scheduler.ts)): drop sections
   that violate hard rules — too early (`earliestStart`), too late
   (`latestEnd`), meeting on a `freeDay`, full when `requireOpenSeats`.
   When a course is fully eliminated, `explainFilteredOut` records *why*
   (this powers the empty-state diagnostics).
3. **Combine**: take the cartesian product of remaining sections across
   courses, pruning any combination where two sections overlap in time
   ([conflicts.ts](../src/domain/conflicts.ts)). If no full combination
   exists, partial schedules are produced with `omittedCourses` + reasons.
4. **Score** ([scoring.ts](../src/domain/scoring.ts)): each schedule starts
   at baseline **100**, then accumulates **penalties** and **clustering
   bonuses**, and blends in a **blockout-fit** score weighted by
   `rules.blockoutWeight / 100`. Final score clamped to `[0, 100]`.

   Penalty/bonus weights live as named constants at the top of
   `scoring.ts` (early-morning is the harshest; per-day-used is a tiebreak
   nudge). Dense days are rewarded via `meetings_per_day²` sums. **If you're
   tuning the ranking, this file is the only place to touch.**
5. **Output**: `Schedule[]` sorted by `qualityScore`, each carrying
   `warnings`, `daysUsed`, on-campus counts, penalty breakdowns, and
   `omittedCourses`.

**Conventions baked into domain types** ([types.ts](../src/domain/types.ts)):

- **Time = HHMM 24-hour integers.** `1400` = 2:00 PM, `800` = 8:00 AM.
  Never store times as strings or Date objects in domain code.
- **Days = `"Mon" | "Tue" | … | "Sun"`** (`DayOfWeek`).
- `subjectCourse` (e.g. `"CPRG306"`) is the **group key**. `crn` is the
  **per-instance key**. Banner does **not** collapse cross-listed aliases,
  and neither do we — don't add dedup that assumes it does (this has bitten
  us; the parser must not dedupe by time/room either, real sections share
  rooms).

---

## 6. Banner SDK — talking to SAIT

Pure TypeScript, no Vue. Built around a **pluggable transport** so tests
and demo mode never hit the wire.

```
createBannerSdk(transport, opts)  →  { session, registration, general, selfService, disconnect }
        │
        ├─ registration  → ssag6.sait.ca/StudentRegistrationSsb   (class search, section details, terms, active regs)
        ├─ general        → ssag2.sait.ca/BannerGeneralSsb        (getBannerId — the login-validation chokepoint)
        └─ selfService    → ssag1.sait.ca/StudentSelfService      (GPA, notices, registered courses, holds, picture)
```

Key pieces:

- **Transport** ([transport/](../src/banner-sdk/transport/)) — interface
  with two impls: `ExtensionTransport` (forwards `BANNER_FETCH` to the
  service worker) and `MockTransport` (records every call, returns canned
  responses — the test/demo backbone).
- **Host pinning** ([config/hosts.ts](../src/banner-sdk/config/hosts.ts)) —
  each endpoint lives on exactly one host (ssag1/2/6). The host is encoded
  per-endpoint inside each app module.
- **Session priming** ([core/session.ts](../src/banner-sdk/core/session.ts)) —
  `RegistrationSession.ensureTermPrimed(term)` runs Banner's required
  term-prime dance (usage tracking → saveTerm → term search → usage
  tracking) and caches `primedTerm` so it only runs once per term. ssag1 &
  ssag2 also need a one-shot credentialed GET to bootstrap per-host cookies
  — that's the `HostPrimer` in [facade.ts](../src/banner-sdk/facade.ts).
  `uniqueSessionId` is generated once per SDK construction via `nanoid()`.
- **The request chokepoint** ([core/request.ts](../src/banner-sdk/core/request.ts)) —
  *every* call funnels through here, which classifies responses into a
  typed error taxonomy:

  | Response | Error |
  |---|---|
  | 403 + small `{"error":"access denied"}` JSON | `BannerNotPermittedError` |
  | 200 + `text/html` (login page) | `BannerSessionExpiredError` |
  | other non-2xx | `BannerHttpError` |
  | network failure / no extension | `BannerNetworkError` / `BannerAuthRequiredError` |

  Consumers branch on these error **types**, never on status codes — keep
  it that way.

The browser extension is deliberately **dumb**: it captures cookies and
proxies `BANNER_FETCH`. All validation, retry, and priming logic lives in
the SDK, not the worker.

> **Security note:** `BANNER_FETCH` should be allowlisted to `*.sait.ca`.
> The content script broadcasts the extension ID to localhost/pages.dev, so
> an open proxy is an SSRF vector. See the memory note on this if hardening.

---

## 7. Auth — the most involved feature

[src/features/auth/](../src/features/auth/) — five collaborating files:

- **`store.ts`** — Pinia state: `status`, `busy`, `lastError`,
  `acquiredAt`, `liveChecked`, a `tick` for age-derived computeds.
- **`service.ts`** — `AuthService` singleton. Drives login / refresh /
  disconnect and wires `setSessionExpiredHandler` from `lib/sdk.ts`. Picks
  `DemoCredentialStore` vs `ExtensionCookieCredentialStore` based on
  `isDemoMode()`.
- **`credentialStore.ts` / `extensionCookieStore.ts` / `demoStore.ts`** —
  pluggable backends. Real auth state persists under `sait-auth-v1` inside
  `extensionCookieStore.ts` (separate from the planner persistence) so
  login survives reloads.
- **`useAuth.ts`** — component-facing composable: reactive refs + bound
  action callbacks.
- **`useAuthInit.ts`** — mounted once at root. Kicks off init + a **60s
  live-check poll** + a **10s age tick** + a `visibilitychange` refresh.

---

## 8. Demo mode

[src/demo/](../src/demo/):

- `index.ts` — `isDemoMode()` (checks `?demo=1` and `VITE_DEMO`) +
  `DEMO_STUDENT_ID` / `DEMO_TERM`.
- `fixtures.ts` — canned Banner responses (terms, active regs, search
  catalog, lookup suggestions).
- `mockBanner.ts` — `createDemoTransport()` wires fixtures into a
  `MockTransport`.
- `composables/useDemoBootstrap.ts` — root-mounted; no-op outside demo,
  else calls `login()` once on mount so the planner has data immediately.

Both `lib/sdk.ts` and the auth service branch on `isDemoMode()` to choose
demo vs real backends. **Switching modes needs a page reload.**

---

## 9. State, side effects, and persistence

### The data-flow spine: `useScheduleSync`

[src/composables/useScheduleSync.ts](../src/composables/useScheduleSync.ts)
is mounted once at the App root and does two things:

1. **watch `[auth.status, auth.liveChecked, term]`** → pull the term list +
   active registrations from Banner, populate `courses`/`term` stores.
   Uses a snapshot/apply split (`fetchBannerSnapshot` returns data; caller
   decides whether to apply or discard if superseded) so a late response
   can't clobber a newer term. Errors fall through to `ui.loadError`; a
   `BannerAuthRequiredError` flips `ui.authRequired` to surface a reconnect
   button.
2. **watch `[courseGroups, selectedCourses, rules]`** → **debounce 200ms**
   then auto-regenerate schedules.

This is *the* place cross-store orchestration happens. **New cross-store
side effects go in `composables/` and mount at the App root — never inside
a feature component.**

### Store discipline (non-negotiable)

- **Setup-style** Pinia stores throughout.
- `Map` and `Set` state lives in `shallowRef` and is **replaced
  wholesale** on every mutation:
  `courseGroups.value = new Map(courseGroups.value); …`. **Never mutate in
  place** — reactivity depends on the replacement.
- Use `storeToRefs` when destructuring reactive state in components.
- All async composables use a `runId` cancellation token + `onUnmounted`
  cleanup so a late SDK response can't write into a stale store.

### Persistence

[src/lib/persistence.ts](../src/lib/persistence.ts) is a tiny
`$subscribe` helper. Each store exports its own `persist<Store>Store()`,
called once in [main.ts](../src/main.ts). Persisted today (prefix
`sait-sb-v1:`):

- `rules` (whole object)
- `term` (string)
- `selectedCourses` (Set → array)
- `currentReg.sectionOverrides` (Map → array) + `includedCourses` (Set → array)

**Generated schedules and transient UI flags are deliberately NOT
persisted.** To wipe local prefs: `clearPersistedState("sait-sb-v1:")`.

### Term cascade

`term/store.ts`'s `setTerm` **wipes every per-term store** (courses,
selection, current, schedules) so a `subjectCourse` key from one term can
never leak into another. `rules` is the deliberate exception — it survives.

---

## 10. UI structure

No router. Tab-style navigation inside [MainArea.vue](../src/shell/MainArea.vue).

```
App.vue
  ├─ SignInScreen.vue          (when not authenticated)
  └─ AppShell.vue              (when authenticated)
       ├─ AppHeader.vue        (GpaChip, ConnectionStatus, ThemePicker, holds)
       ├─ CoursesPanel.vue     (CourseSearch + CourseSelector)
       └─ MainArea.vue         (tabs: Schedules / Rules / Current registration)
            ├─ schedules/      CalendarGrid, ScheduleStrip, ScheduleDetail
            ├─ rules/          RulesPanel, BlockoutGrid
            └─ current/        CurrentScheduleEditor
```

Shared primitives live in [src/ui/](../src/ui/) (`Button`, `Card`,
`Spinner`, `EmptyState`, `StatusDot`, `Popover`). Styling is **Tailwind 4**
(CSS-first `@theme` config); multi-theme via `data-theme` + `@layer base`.
Use `@apply` **only** inside `ui/` primitives, not feature components.

---

## 11. Testing

```bash
bun run test:run    # vitest run, CI-safe
```

~88 tests across ~15 files. **Tests live in a `tests/` subfolder of the
module they cover:**

- `domain/tests/` — scheduler, scoring, conflicts, time, parser
- `banner-sdk/tests/` — request chokepoint (error classification), search,
  registration listActive, selfService priming
- `features/{term,courses,schedules,current}/tests/` — store-level tests
- `features/auth/tests/` — AuthService init / login / reauth / disconnect
- `features/identity/tests/` — `useIdentity` composable

**`MockTransport`** ([transport/mock.ts](../src/banner-sdk/transport/mock.ts))
records every call and returns canned responses — pass it to
`createBannerSdk` to test SDK consumers without the wire. Store tests use
`createPinia` + `setActivePinia`. jsdom environment, `tsconfigPaths` on.

---

## 12. Build & ship

- `bun run build` → type-check (vue-tsc) + Vite build → `dist/`, a loadable
  unpacked MV3 extension.
- `@crxjs/vite-plugin` generates the manifest from
  [manifest.config.ts](../manifest.config.ts) (permissions: `cookies`,
  `tabs`, `storage`; host perms `https://*.sait.ca/*`).
- Vite config ([vite.config.ts](../vite.config.ts)): `@` alias, Vue +
  devtools + Tailwind + crxjs + Vue-MCP plugins, sourcemaps on.
- TypeScript is split: `tsconfig.app.json` (the SPA),
  `tsconfig.extension.json` (the worker/content scripts),
  `tsconfig.node.json` (build tooling).
- Dev shell via **devenv/Nix** (`devenv.nix`, `.envrc`); `direnv allow` or
  `nix develop`.

> `@crxjs/vite-plugin` v2.5 is unmaintained but Vite-8 compatible (expect
> a few harmless warnings). **WXT** is the actively-maintained successor if
> the extension build is ever restructured.

---

## 13. "Where do I change…?" cheat sheet

| I want to… | Go to |
|---|---|
| Tune how schedules rank | [domain/scoring.ts](../src/domain/scoring.ts) — named penalty/bonus constants at top |
| Change conflict / overlap logic | [domain/conflicts.ts](../src/domain/conflicts.ts) |
| Add/change a scheduling rule | [domain/types.ts](../src/domain/types.ts) (`ScheduleRules`) + filter in [scheduler.ts](../src/domain/scheduler.ts) + UI in [rules/RulesPanel.vue](../src/features/rules/RulesPanel.vue) |
| Map a new Banner field into the app | [domain/parser.ts](../src/domain/parser.ts) — the only seam |
| Add a Banner endpoint | new fn in the right `banner-sdk/apps/<app>/`, pin host in `config/hosts.ts`, route errors through `core/request.ts` |
| Add cross-store side effect | new composable in `composables/`, mount in [App.vue](../src/App.vue) |
| Add per-feature reactive state | the feature's `store.ts` (shallowRef + immutable replace) |
| Persist new state | export `persist<X>Store()` from the store, call it in [main.ts](../src/main.ts) |
| Add a shared UI widget | [src/ui/](../src/ui/) |
| Add demo data | [demo/fixtures.ts](../src/demo/fixtures.ts) |
| Change extension permissions / hosts | [manifest.config.ts](../manifest.config.ts) |

---

## 14. Gotchas (learned the hard way)

- **Times are HHMM integers**, not strings/Dates. `830` ≠ 8.5 hours.
- **Don't dedupe sections by time+room** in the parser — real distinct
  sections legitimately share a room/time; CRN is the only safe instance
  key, `subjectCourse` the only group key.
- **Don't mutate Map/Set state in place** — replace the whole value or
  reactivity silently breaks.
- **SDK fetches belong in composables, not stores.**
- **Branch on Banner error types, not HTTP status codes.**
- **Switching demo/real needs a page reload** — the SDK + auth backends are
  chosen at construction.
- Zombie Vite processes can squat port 5173 — check
  `pgrep -af "vite|bun.*dev"` before `bun dev`.
- `setTerm` is destructive across per-term stores by design; `rules`
  survives — don't "fix" that.
```
