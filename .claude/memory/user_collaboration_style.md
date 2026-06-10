---
name: user-collaboration-style
description: "How Eric wants me to drive work on this repo — aggressive parallelism, decisive cuts, frequent commits, strict maintainability."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: eeabaaca-3027-4962-84c9-909ff7354281
---

Eric runs this project with a "drive the ship sharp and hard" directive. The patterns that have worked:

**Aggressive parallelism.** When 3+ independent feature ports are queued, dispatch them as concurrent background sub-agents (one Agent tool call per feature, `run_in_background: true`). Don't serialize independent work. Main thread should pick up integration shell + tests + commits while agents run.

**Commits as you go.** Logical chunks get their own commit — extension build, SDK port, foundation, theme + tests, feature wave, etc. Don't batch unrelated work into one mega-commit. Stage by file group with `git add <paths>`, write a HEREDOC commit body that lists what changed and why.

**No emoji in code or commit messages.** Strict. Also no "I" / chatty preambles in commit bodies.

**Maintainability is the explicit highest priority.** Eric has stated it as a hard rule ("EVERYTHING must be HIGHLY maintainable"). Concretely:
- One concern per Pinia store, never multi-slice
- Composables for cross-store side effects, never inside feature components
- Controlled components for UI — receive data via props, emit changes up
- `shallowRef` for Map/Set + immutable replacement on mutation (mirrors the React Zustand discipline)
- Cross-store cascades go through the destination store's own clear action; no cross-store knowledge of internal shape
- One short JSDoc per file explaining WHY it's interesting; never comment WHAT the code does

**Why:** This app was ported from a battle-tested React architecture and Eric wants the same discipline maintained as it evolves. Lapses here are noticed.

**How to apply:** Default to parallel sub-agents for ≥3 independent ports. Commit each landed wave before starting the next. Refuse to take shortcuts that compromise the patterns above even under time pressure.
