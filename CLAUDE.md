# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev        # Start Vite dev server (localhost:5173)
pnpm build      # Type-check (tsc -b) then build
pnpm preview    # Preview production build
```

Dev environment uses a Nix flake — run `direnv allow` or `nix develop` to enter the shell.

## Architecture

SAIT Schedule Builder is a client-side React/TypeScript SPA. It fetches course sections from the SAIT Banner registration system and generates non-conflicting schedule combinations ranked by quality.

### Data flow

1. **Credential capture** — Users paste session headers (or use the `extension/` Manifest v3 browser extension to copy them automatically). `HeaderInput` parses credentials; `api.ts` attaches them to Banner API calls via Vite's proxy rewrite (works around Fetch's forbidden-header restrictions).

2. **Course ingestion** — `CourseSearch` queries Banner by course code; `parser.ts` normalizes `BannerResponse` → `CourseSection[]`, grouping sections by `subjectCourse` (e.g. `"CPRG306"`).

3. **Schedule generation** — `scheduler.ts` builds the Cartesian product of selected sections, validates each combination against hard constraints (no time conflicts, free-day rules, on-campus day cap, optional seat availability), then calls `scoring.ts` to rank survivors.

4. **Scoring & warnings** — `scoring.ts` applies soft penalties (early morning, travel gaps, large gaps between classes, blockout grid fit) producing a `qualityScore` and structured `ScheduleWarning[]`.

5. **State** — `useScheduler.ts` is the single central hook. It owns `courseGroups` (Map), `selectedCourses` (Set), `schedules[]`, `rules`, `credentials`, and `currentRegistrations`. All updates use functional setState with new Map/Set instances.

6. **UI** — `App.tsx` composes a sidebar (credentials → search → course selector → rules panel → schedule browser) with a main area tabbed between "Current Schedule" (`CurrentScheduleEditor`) and generated schedules (`CalendarGrid` + `ScheduleDetail`).

### Key conventions

- **Time format**: 24-hour integers — `1400` = 2:00 PM, `0800` = 8:00 AM.
- **Day abbreviations**: `Mon | Tue | Wed | Thu | Fri | Sat | Sun` (type `DayOfWeek`).
- **No routing**: single-page tab navigation, no React Router.
- **No persistence**: all state lives in React; nothing is saved to localStorage or a backend.
- **Anthropic SDK** is installed but not yet wired into the app — placeholder for future LLM-powered suggestions.
