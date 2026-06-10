---
name: dev-server-gotchas
description: "Repo-specific dev-server traps — zombie vite processes squatting port 5173, and harmless crxjs warnings on Vite 8."
metadata: 
  node_type: memory
  type: project
  originSessionId: eeabaaca-3027-4962-84c9-909ff7354281
---

**Zombie vite processes squatting port 5173.** Long-running `vite` / `bun dev` processes from earlier sessions can survive shell exit and hold the port. Symptom: new `bun dev` reports "Port 5173 is in use, trying another one..." and any request to localhost:5173 returns a 500 with a phantom path referencing dependencies that don't exist on disk anymore (e.g. `node_modules/.pnpm/@tailwindcss+node@4.2.4/...` from the pre-bun era). Killing the orphan fixes it.

**Why:** ESM loaders (e.g. `@tailwindcss/node`'s `esm-cache.loader.mjs`) register into the running Node process and cache resolution paths against the original install location. After a reinstall (especially the pnpm→bun migration this branch did mid-flight), the loader still points at the old layout until the process restarts.

**How to apply:** Before `bun dev`, check for orphans:

```
pgrep -af "pnpm.*dev|node.*vite|bun.*dev"
```

Kill any matches. Then `bun dev` boots cleanly. If you nuke `node_modules` and reinstall without killing the process first, the symptom persists — it's process state, not filesystem state.

**Harmless surface noise on Vite 8 + @crxjs/vite-plugin 2.5.0:**

- `Both rollupOptions and rolldownOptions were specified by "crx:content-scripts" plugin. rollupOptions specified by that plugin will be ignored.` — build still works.
- `Unknown input options: platform.` — tied to one of the dev plugins (likely `vite-plugin-vue-mcp`); ignore.
