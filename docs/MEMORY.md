# Memory Index

- [Banner API Architecture](banner_api.md) — Auth/proxy setup, all key endpoints, response format differences, parser mapping, term-filtering logic
- [User collaboration style](user_collaboration_style.md) — drive sharp + hard: parallel sub-agents, commit each wave, strict maintainability discipline.
- [Vue docs MCP](vue_docs_mcp.md) — activate at session start; api_lookup works, docs_search + server itself flaky — fall back to WebFetch on official docs.
- [Vue + Pinia conventions](vue_pinia_conventions.md) — setup stores, shallowRef + immutable, storeToRefs, composables-at-root for cross-store side effects, acceptHMRUpdate on every store.
- [Folder structure recommendation](folder_structure_recommendation.md) — consolidate planner stores into `src/features/<name>/`, move identity/profile/holds/theme under features/; keep pure layers (banner-sdk, domain, lib, ui, shell) top-level.
- [CRXJS status](crxjs_status.md) — `@crxjs/vite-plugin` v2.5 unmaintained but Vite-8 compatible; WXT is the actively-maintained successor for any future restructure.
- [Security: BANNER_FETCH allowlist](security_banner_fetch_allowlist.md) — real SSRF risk via inject.ts ext-ID broadcast + open BANNER_FETCH; two-line `*.sait.ca` allowlist closes it.
- [Tailwind 4 patterns](tailwind_4_patterns.md) — CSS-first `@theme` config; multi-theme via `data-theme` + `@layer base`; `@apply` only inside ui/ primitives.
- [Vitest + Vite patterns](vitest_vite_patterns.md) — `createPinia`+`setActivePinia` for store tests, jsdom over browser mode, `tsconfigPaths: true`, single config with conditional crxjs plugin, keep oxlint+eslint dual.
- [Dev server gotchas](dev_server_gotchas.md) — zombie vite processes squat 5173; check `pgrep -af "vite|bun.*dev"` before `bun dev`; harmless crxjs warnings on Vite 8.
- [React port reference](react_port_reference.md) — Vue port is feature-complete vs React main; keep this for cribbing future feature shapes from LeaderbotX400/sait-schedule-builder.
- [SAIT data model](sait_data_model.md) — `subjectCourse` is the group key; CRN is the per-instance key. No cross-listing alias collapse — Banner doesn't do that.
- [Parser dedupe unsafe](parser_dedupe_unsafe.md) — time/place key dedupe in parser is wrong; real sections legitimately share time+room. Confirmed via PROJ309 ref data 2026-06-08.
