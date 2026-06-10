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
schedule generation, scoring) happens in the browser — generation itself
in a Web Worker.

Two runtime shapes share one codebase:

| Context | How it loads | How it reaches Banner |
|---|---|---|
| **In-extension** | `chrome-extension://<id>/index.html` | `chrome.runtime.sendMessage(msg)` → background worker |
| **Web (dev / pages.dev)** | `localhost:5173` or `*.sait-scheduler.pages.dev` | `chrome.runtime.sendMessage(extId, msg)` — extension ID supplied explicitly, origin authorized by `externally_connectable` |

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

---

## 3. The layering (the one rule that matters)

Each concern lives in **exactly one layer**, and dependencies point
**downward only**. Memorize this gradient — almost every review comment
is "this belongs one layer down/up."

```
  ┌──────────────────────────────────────────────────────────┐
  │ shell/  +  features/<x>/*.vue        UI (Vue SFCs)        │  knows Vue, knows stores
  ├──────────────────────────────────────────────────────────┤
  │ features/planner/actions.ts          orchestration        │  ALL cross-store workflows
  │ composables/                         mount-once glue      │  watchers → planner actions
  ├──────────────────────────────────────────────────────────┤
  │ features/<x>/store.ts                Pinia stores         │  own slice only — never call
  │                                                           │  another store's actions
  ├──────────────────────────────────────────────────────────┤
  │ ui/                                  presentational kit   │  NO store imports, ever
  │ lib/  +  plugins/                    plumbing             │  bridge, SDK singleton,
  │                                                           │  termSlots, persistence
  ├──────────────────────────────────────────────────────────┤
  │ banner-sdk/                          typed Banner client  │  no Vue — FROZEN wire contract
  │ domain/                              pure scheduling      │  no Vue, no Banner shapes
  └──────────────────────────────────────────────────────────┘
```

Three rules are structural, not stylistic:

1. **Stores never call other stores' actions.** Any mutation that spans
   stores is a named, awaitable function in
   [features/planner/actions.ts](../src/features/planner/actions.ts).
   Reading another store is fine; better still, take the data as a
   parameter (see `current/store.ts`'s `swapSection(…, catalog)`).
2. **`src/ui/` never imports stores.** That's what keeps `WeekGrid`,
   the Reka wrappers, and the course formatters shareable.
3. **The Banner SDK's wire behavior is frozen.** Internal refactors fine;
   anything that changes hosts/endpoints/shapes/errors is not. The tests
   in `src/banner-sdk/tests/` are the contract pin.

Two layers are **pure** and have **zero framework imports**:

- **`domain/`** — types, scheduler, scorer, conflict detection, time math,
  explainEmpty diagnostics, iCal export. No Vue, no Banner.
- **`banner-sdk/`** — typed Banner HTTP client. No Vue. Pluggable transport.

The seam between Banner shapes and domain shapes is
[src/domain/parser.ts](../src/domain/parser.ts). Banner JSON →
`CourseSection` happens there and **only** there.

### Import conventions

- Cross-feature or feature→top-level: use the `@/` alias
  (`@/features/catalog/store`, `@/lib/sdk`, `@/domain/types`).
- **Within** a feature: relative (`./store`).
- **No barrel files** — the only `index.ts` is `banner-sdk/index.ts`
  (part of the SDK's public facade).

---

## 4. Directory map

```
src/
  banner-sdk/        # typed Banner client (see §6) — FROZEN wire contract
    apps/            #   one folder per Banner app: general / registration / selfService
    core/            #   request chokepoint (classifyRawResponse + hooks), session priming
    transport/       #   ExtensionTransport (real) + MockTransport (tests) + errors
    config/hosts.ts  #   host-per-endpoint pinning (ssag1/2/6)
    facade.ts        #   createBannerSdk(transport, { hosts?, uniqueSessionId?, hooks? })
  domain/            # pure scheduling logic (see §5)
  lib/               # cross-cutting plumbing
    sdk.ts           #   getSdk() singleton + setSdkErrorHandler (via SDK hooks.onError)
    termSlots.ts     #   createTermSlots<T>() — THE per-term slot implementation
    bridge/          #   app↔extension protocol
      protocol.ts    #     message types + createBridgeRouter (imported by BOTH sides)
      client.ts      #     sendBridgeMessage / openBridgePort
    extension.ts     #   bannerFetch/bannerPrime wrappers over the bridge
    extensionId.ts / extensionIdListener.ts   # ext-ID handshake (web context)
    terms.ts / types.ts / logger.ts
  plugins/
    persistence.ts   #   THE Pinia persistence plugin (persist spec per store + codecs)
    migrateLegacy.ts #   one-shot legacy localStorage translation (only file that
                     #   knows pre-v2 shapes)
  composables/       # mount-once cross-feature glue + the async primitive
    useAsyncTask.ts  #   latest-wins async task (watch/enabled/retry/AbortSignal)
    useScheduleSync.ts   # auth watcher → syncActiveTerm; debounced regenerate
    useExtensionIdListener.ts
  ui/                # presentational kit — NO store imports
    Button/Card/Spinner/StatusDot/EmptyState    # hand-rolled
    Popover.vue / Select.vue                    # Reka UI wrappers
    course/          #   shared course/section label formatting + format tests
    week-grid/       #   useWeekGridLayout + WeekGrid chrome + layout tests
  shell/             # SignInScreen, AppShell, AppHeader, CoursesPanel, MainArea
  features/          # one folder per domain — store + components + tests colocated
  App.vue            # mounts root composables; swaps SignInScreen ⇄ AppShell
  main.ts            # createApp + pinia.use(createPersistencePlugin()) + mount
extension/
  background.ts      # MV3 service worker — typed router over lib/bridge/protocol
  bannerProxy.ts     # BANNER_FETCH / BANNER_PRIME with the *.sait.ca SSRF allowlist
  cookies.ts         # CHECK_LOGIN / CLEAR_SESSION
  login.ts           # port-based SAML login flow (port keeps the SW alive)
  inject.ts          # content script: announces extension ID to localhost / pages.dev
```

### The feature modules

| Feature | Owns | Notes |
|---|---|---|
| `auth/` | login state + `studentId`, `AuthService`, credential store | see §7 |
| `term/` | active term + picker options — **pure state** | the cascade lives in planner |
| `catalog/` | `Map<subjectCourse, CourseSection[]>` per term | live cache, not persisted |
| `selection/` | selected courses **+ pinned CRNs** per term | persisted |
| `rules/` | `ScheduleRules` | **survives** term switches (real prefs) |
| `schedules/` | generated `Schedule[]`, activeIndex, async `generate(input)` | Web Worker executor |
| `current/` | current-registration slots + overrides + editor | catalog injected as param |
| `saved/` | saved picks per term — pure CRUD | reload logic lives in planner |
| `search/` | `CourseSearch.vue` | no store |
| `planner/` | **no store** — all cross-store workflow actions | see §9 |
| `theme/` | theme choice (`data-theme` + Tailwind tokens) | persisted |
| `ui-state/` | `loadError`, `registrationsLoading`, `authRequired`, slot warnings | transient |

---

## 5. Domain layer — how a schedule gets built

This is the heart, and it's pure functions you can test without a browser.

1. **Input**: `GenerateInput` — the selected slice of the catalog
   (`Map<subjectCourse, CourseSection[]>`), the current `ScheduleRules`,
   and the pinned CRNs. Assembled by
   `planner.currentGenerateInput()`; the schedules store takes it as an
   explicit argument.
2. **Filter** ([scheduler.ts](../src/domain/scheduler.ts)): drop sections
   that violate hard rules — too early/late, meeting on a `freeDay`, full
   when `requireOpenSeats`. Pinned sections bypass the filter.
3. **Combine**: cartesian product of remaining sections, pruning
   time-overlapping combinations ([conflicts.ts](../src/domain/conflicts.ts)).
   If no full combination exists, partial schedules carry `omittedCourses`.
4. **Score** ([scoring.ts](../src/domain/scoring.ts)): baseline **100**,
   penalties + clustering bonuses + blockout-fit blended by
   `rules.blockoutWeight / 100`. **If you're tuning the ranking, this file
   is the only place to touch.**
5. **Output**: `Schedule[]` sorted by `qualityScore`. Zero results are
   diagnosed by [explain.ts](../src/domain/explain.ts) into the
   user-facing empty-state blurb.

Generation runs **off the main thread**:
[features/schedules/executor.ts](../src/features/schedules/executor.ts)
defines a pluggable executor — a module Web Worker in the app
(`generate.worker.ts`), `syncExecutor` in tests and as automatic fallback.
Inputs are unwrapped with `toRaw` at the worker boundary
(`toClonableInput`) because Pinia hands back reactive proxies that
structured clone rejects.

**Conventions baked into domain types** ([types.ts](../src/domain/types.ts)):

- **Time = HHMM 24-hour integers.** `1400` = 2:00 PM. Never strings/Dates.
- **Days = `"Mon" | … | "Sun"`** (`DayOfWeek`).
- `subjectCourse` is the **group key**; `crn` the **per-instance key**.
  Banner does **not** collapse cross-listed aliases — don't dedupe by
  time/room in the parser (real sections share rooms; this has bitten us).

---

## 6. Banner SDK — talking to SAIT (FROZEN CONTRACT)

Pure TypeScript, no Vue. Built around a **pluggable transport** so tests
never hit the wire.

```
createBannerSdk(transport, opts)  →  { session, registration, general, selfService, disconnect }
        │
        ├─ registration  → ssag6 StudentRegistrationSsb   (class search, terms, lookups, active regs)
        ├─ general        → ssag2 BannerGeneralSsb        (getBannerId — the login-validation chokepoint)
        └─ selfService    → ssag1 StudentSelfService      (profile, holds — kept intact though unused by the app)
```

Key pieces:

- **Transport** — `ExtensionTransport` (forwards `BANNER_FETCH` through
  the bridge) and `MockTransport` (records calls, returns canned
  responses — the test backbone; note function handlers receive a
  `RecordedCall`, use `call.url`).
- **Host pinning** ([config/hosts.ts](../src/banner-sdk/config/hosts.ts)) —
  each endpoint lives on exactly one host.
- **Session priming** ([core/session.ts](../src/banner-sdk/core/session.ts)) —
  `ensureTermPrimed(term)` runs Banner's 4-call term-prime dance and
  caches `primedTerm`. ssag1/ssag2 get a one-shot credentialed GET via the
  `HostPrimer`. `uniqueSessionId` is `nanoid()` per SDK construction.
- **The request chokepoint** ([core/request.ts](../src/banner-sdk/core/request.ts)) —
  every call funnels through `classifyRawResponse`:

  | Response | Error |
  |---|---|
  | 403 + small `{"error":"access denied"}` JSON | `BannerNotPermittedError` |
  | network failure, status 0 | `BannerAuthRequiredError` |
  | other transport error | `BannerNetworkError` |
  | other non-2xx | `BannerHttpError` |
  | 200 + `text/html` (login page) | `BannerSessionExpiredError` |

  Consumers branch on these error **types**, never on status codes.

- **`hooks.onError`** (additive option on `createBannerSdk`) fires from
  the chokepoint on every classified failure. `lib/sdk.ts` exposes
  `setSdkErrorHandler`; the auth service uses it to flip auth state on
  `BannerSessionExpiredError`. `validateLogin` deliberately runs hookless —
  the login probe's failures are expected outcomes, not expiry events.

The browser extension is deliberately **dumb**: it proxies allowlisted
fetches and manages cookies. All validation, retry, and priming logic
lives in the SDK.

---

## 7. Auth

[src/features/auth/](../src/features/auth/):

- **`store.ts`** — `status`, `busy`, `lastError`, `acquiredAt`,
  `liveChecked`, age tick, plus **`studentId`/`validating`** (the old
  identity feature, folded in).
- **`service.ts`** — `AuthService` singleton: login/refresh/disconnect,
  wires `setSdkErrorHandler`.
- **`credentialStore.ts` / `extensionCookieStore.ts`** — the pluggable
  backend. Auth state persists under `sait-auth-v1` (separate from
  planner persistence). Talks to the SW via the shared bridge client.
- **`useAuth.ts`** — component-facing composable.
- **`useAuthInit.ts`** — mounted once at root: service init, 60s
  live-check poll + 10s age tick (vueuse `useIntervalFn`), visibility
  refresh (`useDocumentVisibility`), and a `useAsyncTask` that resolves
  `studentId` via `validateLogin` when the session becomes live-checked
  authenticated.

---

## 8. State, side effects, and persistence

### Orchestration: planner actions

[features/planner/actions.ts](../src/features/planner/actions.ts) is the
only place multiple stores are mutated together:

- `switchTerm(code)` — THE term cascade: set term → clear derived
  schedules → reset transient UI → `await syncActiveTerm()`. Only
  `TermPicker` and `loadSavedSchedule` call it; nothing else writes `term`.
- `addSearchResults` / `removeCourse` / `clearTermData`.
- `swapSection` / `getCurrentSchedule` — inject the catalog into the
  current store.
- `loadSavedSchedule` — switch term → `search.byCourses` → rehydrate →
  `await generate()` → seek the best-matching schedule index.
- `syncActiveTerm` — latest-wins Banner sync with one explicit retry for
  Banner's term-prime lag; revalidates persisted future-term selection
  slots against a fresh class search (slot warnings surface in the UI).

[composables/useScheduleSync.ts](../src/composables/useScheduleSync.ts)
is thin wiring: `[auth.status, auth.liveChecked]` → `syncActiveTerm`;
`watchDebounced` (200 ms) over `[catalog, selection, rules]` →
`regenerate()`.

### Per-term slots

`catalog`, `selection`, `current`, `saved` are thin CRUD over
[`createTermSlots<T>()`](../src/lib/termSlots.ts): a
`Map<termCode, T>` in a `shallowRef`, replaced immutably, with a
reference-stable empty `active` computed. **Switching terms swaps the
visible slot — nothing is wiped.** `rules` is the deliberate exception:
it survives term switches.

### Async discipline

Any cancellable fetch goes through
[`useAsyncTask`](../src/composables/useAsyncTask.ts) — latest-wins
(superseded runs write nothing), `enabled` gating, retry, AbortSignal,
auto-cancel on scope dispose. Don't hand-roll `runId` counters.

### Persistence

[plugins/persistence.ts](../src/plugins/persistence.ts) is one Pinia
plugin. A store opts in declaratively:

```ts
defineStore("term", () => { … }, {
  persist: { key: "term", version: 1, pick: (s) => s.term, apply: (s, d) => … },
});
```

Values are versioned envelopes `{ v, data }` under `sait-sb-v2:<key>`.
The `codecs` toolbox handles Map/Set shapes; corrupt payloads skip
hydration. Persisted: term, rules, selection (incl. pins), current
overrides+included, saved, theme. **Generated schedules and transient UI
flags are deliberately NOT persisted.**

[plugins/migrateLegacy.ts](../src/plugins/migrateLegacy.ts) is the only
file that knows pre-v2 localStorage shapes — it translates every legacy
key once at plugin install and deletes the originals (fixture-tested).

To wipe local prefs: `clearPersistedState()` from `plugins/persistence.ts`.

---

## 9. UI structure

No router. Tab-style navigation inside [MainArea.vue](../src/shell/MainArea.vue).

```
App.vue
  ├─ SignInScreen.vue          (when not authenticated)
  └─ AppShell.vue              (when authenticated)
       ├─ AppHeader.vue        (TermPicker, ConnectionStatus, ThemePicker, actions)
       ├─ CoursesPanel.vue     (CourseSearch + CourseSelector)
       └─ MainArea.vue         (tabs: Current registration / Planner)
            ├─ rules/          RulesPanel, BlockoutEditor   (WeekGrid consumer)
            ├─ schedules/      CalendarGrid (WeekGrid consumer), ScheduleStrip,
            │                  ScheduleDetail, LockedSectionsBanner
            └─ current/        CurrentScheduleEditor
```

- **Floating UI is Reka UI** (headless): `ui/Popover.vue`,
  `ui/Select.vue`, and the calendar's HoverCard. Reka portals render to
  `<body>`; the theme attribute lives on `documentElement`, so tokens
  apply. In the Popover's `#trigger` slot, **don't bind your own click
  handler** — `as-child` wires it.
- **Week-grid layout math lives only in
  [ui/week-grid/](../src/ui/week-grid/)** — `useWeekGridLayout` (hour
  range expansion, weekend auto-add, HHMM→rem positioning) + the
  `WeekGrid` chrome with `#day-header` / `#cell` / `#day` slots. Both
  `CalendarGrid` and `BlockoutEditor` consume it; never duplicate the math.
- **Course/section label formatting lives only in
  [ui/course/format.ts](../src/ui/course/format.ts)**.
- Styling is **Tailwind 4** (CSS-first `@theme`); multi-theme via
  `data-theme` + token layers in [src/index.css](../src/index.css).

---

## 10. Extension bridge

[lib/bridge/protocol.ts](../src/lib/bridge/protocol.ts) is the single
source of truth for the app↔extension protocol — message names, payload
types, `createBridgeRouter`. Both `extension/background.ts` and the app
compile against it. **The on-the-wire values are frozen** (an installed
extension may be older than the deployed web app); only typing improves.

- App side: `sendBridgeMessage` / `openBridgePort`
  ([lib/bridge/client.ts](../src/lib/bridge/client.ts)) — resolve with a
  `BridgeErrorEnvelope`, never reject.
- SW side: all `chrome.*` listener registrations stay **synchronous at
  `background.ts` top level** (MV3 requirement). The SAML login runs over
  a long-lived port (`login` / `force-reauth`) that keeps the SW alive.
- `bannerProxy.ts` enforces the `*.sait.ca` allowlist — without it, any
  page that learns the extension ID could ride the user's cookies (SSRF).

---

## 11. Testing

```bash
bun run test:run    # vitest run, CI-safe
```

Tests live in a `tests/` subfolder of the module they cover:

- `domain/tests/` — scheduler, scoring, conflicts, time, parser
- `banner-sdk/tests/` — request chokepoint, hooks, search, registration,
  selfService priming — **the SDK contract pin; must pass unmodified**
- `lib/tests/` (termSlots), `lib/bridge/tests/` (router),
  `composables/tests/` (useAsyncTask), `plugins/tests/` (persistence +
  legacy migration fixtures), `ui/week-grid/tests/`, `ui/course/tests/`
- `features/*/tests/` — planner actions (term cascade, saved best-match),
  catalog/schedules/current stores, auth service + useAuthInit

Store tests: `createPinia` + `setActivePinia`. **Pinia plugins only run
once the pinia instance is installed into an app** — persistence-plugin
tests create a throwaway `createApp({}).use(pinia)`.

---

## 12. Build & ship

- `bun run build` → type-check + Vite build → `dist/`, a loadable
  unpacked MV3 extension (includes the schedule worker chunk).
- `@crxjs/vite-plugin` generates the manifest from
  [manifest.config.ts](../manifest.config.ts).
- TypeScript is split: `tsconfig.app.json` (SPA),
  `tsconfig.extension.json` (worker/content scripts — imports
  `src/lib/bridge/protocol.ts` relatively), `tsconfig.node.json` (tooling).
- `@crxjs/vite-plugin` v2.5 is unmaintained but Vite-8 compatible; **WXT**
  is the successor if the extension build is ever restructured.

---

## 13. "Where do I change…?" cheat sheet

| I want to… | Go to |
|---|---|
| Tune how schedules rank | [domain/scoring.ts](../src/domain/scoring.ts) |
| Change conflict / overlap logic | [domain/conflicts.ts](../src/domain/conflicts.ts) |
| Add/change a scheduling rule | `ScheduleRules` in [domain/types.ts](../src/domain/types.ts) + filter in scheduler + UI in `rules/` |
| Change the empty-result diagnostics | [domain/explain.ts](../src/domain/explain.ts) |
| Map a new Banner field into the app | [domain/parser.ts](../src/domain/parser.ts) — the only seam |
| Add a Banner endpoint | the right `banner-sdk/apps/<app>/`, host in `config/hosts.ts`, errors via `core/request.ts` — **wire contract review required** |
| Add a cross-store workflow | [features/planner/actions.ts](../src/features/planner/actions.ts) |
| Add a mount-once side effect | new composable in `composables/`, mount in [App.vue](../src/App.vue) |
| Add per-term state | the feature's store on `createTermSlots` |
| Persist new state | a `persist` spec on the store + codec; bump `version` on shape change |
| Add a shared UI widget | [src/ui/](../src/ui/) — no store imports |
| Add an app↔extension message | [lib/bridge/protocol.ts](../src/lib/bridge/protocol.ts) + handler in `extension/` |
| Change extension permissions / hosts | [manifest.config.ts](../manifest.config.ts) |

---

## 14. Gotchas (learned the hard way)

- **Times are HHMM integers**, not strings/Dates. `830` ≠ 8.5 hours.
- **Don't dedupe sections by time+room** in the parser — real distinct
  sections share rooms; CRN is the only safe instance key.
- **Don't mutate Map/Set state in place** — `createTermSlots` replaces
  wholesale; reactivity depends on it.
- **Pinia hands back reactive proxies** — anything crossing a structured-
  clone boundary (Worker postMessage) must go through `toRaw` first
  (`toClonableInput` in the schedules executor).
- **Branch on Banner error types, not HTTP status codes.**
- **Don't write `term.term` directly** — go through `planner.switchTerm`
  or the cascade won't run.
- **Don't bind `@click` on a Reka Popover trigger** — `as-child` already
  wires it; you'll double-toggle.
- Zombie Vite processes can squat port 5173 — check
  `pgrep -af "vite|bun.*dev"` before `bun dev`.
