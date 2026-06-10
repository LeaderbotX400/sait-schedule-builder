---
name: memories-live-in-repo
description: Write all memory files to .claude/memory/ inside this repo, never to ~/.claude
metadata:
  type: feedback
---

All memories for this project go in `.claude/memory/` at the repo root (`/home/eric/projects/sait/schedule-builder/.claude/memory/`), with the index in `MEMORY.md` there. Never write them to the `~/.claude/projects/...` memory directory.

**Why:** Eric wants memories to travel with the repository rather than being scoped to a single machine — `~/.claude` memories are invisible on other machines and to anyone else working in the repo.

**How to apply:** On every memory save, Write to `<repo>/.claude/memory/<slug>.md` and update `<repo>/.claude/memory/MEMORY.md`. At session start, read that MEMORY.md for recall, since the harness only auto-loads the home-directory one.
