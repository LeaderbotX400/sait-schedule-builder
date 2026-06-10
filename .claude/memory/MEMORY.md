# Memory index

## Feedback / working style
- [Memories live in this repo](memories-live-in-repo.md) — write to `.claude/memory/` here, never to `~/.claude`
- [User collaboration style](user_collaboration_style.md) — aggressive parallelism, commits per logical chunk, no emoji, maintainability is the hard top priority
- [Vue docs MCP](vue_docs_mcp.md) — Eric requires validating Vue/Pinia patterns against the vue-docs MCP; `*_api_lookup` works, `docs_search` flaky → WebFetch official docs
- [No nested ternaries in class bindings](no-nested-ternaries-in-class-bindings.md) — per-item classes in data or a computed map; flat conditionals only

## Domain / data model
- [SAIT data model](sait_data_model.md) — `subjectCourse` is the group key, CRN is the instance key; never alias-collapse or CRN-dedup in `byCourses`
- [Parser dedupe unsafe](parser_dedupe_unsafe.md) — never dedupe sections/meetings by time+place key; real PROJ309 data has legitimate collisions
- [Banner API facts](banner_api.md) — junk terms in `getTerms`, meetingTimes shape differs per endpoint, sponsored registrations missing from `getRegistrationEvents`

## Architecture / security
- [Banner fetch SSRF allowlist](security_banner_fetch_allowlist.md) — the allowlist in `extension/bannerProxy.ts` is load-bearing; never loosen, never hardcode the ext ID
- [Vue + Pinia conventions](vue_pinia_conventions.md) — setup stores, acceptHMRUpdate, storeToRefs rules, persistence plugin, toRaw at clone boundaries

## Tooling / environment
- [Dev server gotchas](dev_server_gotchas.md) — zombie vite processes squat port 5173 (kill before `bun dev`); harmless crxjs warnings on Vite 8
- [Tailwind 4 patterns](tailwind_4_patterns.md) — CSS-first `@theme`, `data-theme` attribute for named themes, `@apply` only inside `ui/` primitives
- [Vitest + Vite patterns](vitest_vite_patterns.md) — createTestingPinia only for component mounts, jsdom over browser mode, DI over vi.mock, oxlint+eslint stays dual
- [CRXJS status](crxjs_status.md) — @crxjs/vite-plugin unmaintained but works on Vite 8; WXT is the successor if build needs rework; MV3 SW lifecycle facts
- [React port reference](react_port_reference.md) — original React repo (historical); only crib shapes for brand-new analogous features
