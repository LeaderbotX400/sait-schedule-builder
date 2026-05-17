# SAIT Schedule Builder

> [!IMPORTANT]
> This is a vibe-coded slop project made to provide a better user experience to SAIT's official "Banner" system by Eulician.

I really liked how some other universities provided you with a way to just select some courses. Set some rules (start time, days off, etc), and it would automatically generate some schedule options for you. This aims to implement similar features completely in your own browser.

---

Client-side React/TypeScript SPA that pulls course sections from SAIT's
Banner registration system generates a non-conflicting schedule
combinations ranked by quality. Ships with a Manifest v3 Chrome
extension that captures Banner credentials so the app can talk to the
authenticated APIs without a server.

## Quick start

```bash
direnv allow            # or: nix develop
pnpm install
pnpm dev                # Vite dev server on http://localhost:5173
```

To build the extension:

```bash
pnpm build              # outputs dist/ — load that as an unpacked
                        # extension at chrome://extensions
```

## Scripts

| Command          | What it does                                    |
| ---------------- | ----------------------------------------------- |
| `pnpm dev`       | Vite dev server (`--host`, port 5173)           |
| `pnpm build`     | `tsc -b && vite build`                          |
| `pnpm preview`   | Preview the production build                    |
| `pnpm typecheck` | `tsc -b --noEmit`                               |
| `pnpm test`      | `vitest` watch mode                             |
| `pnpm test:run`  | `vitest run` (CI-safe; passes with no tests)    |
| `pnpm test:ui`   | vitest in `@vitest/ui`                          |
| `pnpm lint`      | `biome check`                                   |
| `pnpm format`    | `biome format --write`                          |
| `pnpm fix`       | `biome check --write`                           |
| `pnpm check`     | full pipeline: typecheck + lint + tests + build |

Pre-commit runs biome via simple-git-hooks + lint-staged.

## Layout

See `CLAUDE.md` for the full architecture write-up. In one screen:

```
src/banner-sdk/   typed Banner client (transport, session, apps)
src/domain/       pure scheduling logic + types (no React, no Banner)
src/store/        Zustand store, sliced + persisted to localStorage
src/features/     feature-grouped UI (auth, search, selection, rules,
                    schedule, current, registration, status)
src/hooks/        useAuth, useScheduleSync (cross-slice side effects)
src/ui/           shared UI primitives
src/lib/          chrome extension bridge + Banner-shape types
extension/        Manifest v3 service worker + content scripts
```

## How it works

The extension's content script scrapes the per-page synchronizer token
from any Banner page the user visits and forwards it to the service
worker. The web app messages the service worker via
`chrome.runtime.sendMessage` (or `externally_connectable` from
`localhost`/`*.sait-scheduler.pages.dev`) to get the token, install
cookies for manual auth, or proxy authenticated fetches through
`BANNER_FETCH` (which carries the user's Banner session cookies via
`credentials: "include"`).

The `Banner SDK` (`src/banner-sdk/`) sits on top of that transport.
It owns the per-host base URLs, the per-page sync token cache, the
per-session uniqueSessionId, and the term-priming round-trip Banner
needs before searches return rows. UI components never reach into HTTP
— they call typed methods like `sdk.registration.search.byCourses`,
which are routed through a single chokepoint (`core/request.ts`) that
classifies Banner's status responses and refreshes/retries the sync
token where it can.

State lives in a Zustand store with eight slices. User preferences
(rules, term, selections) persist to `localStorage` under `sait-sb-v1`;
generated schedules and the credentials blob never touch storage.
