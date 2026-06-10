---
name: sait-data-model
description: SAIT Banner data model facts (group key vs. instance key) the user confirmed on 2026-06-08 after I built a wrong premise about cross-listing.
metadata: 
  node_type: memory
  type: project
  originSessionId: 980a8545-1553-4f5f-b1db-85bd082a1c9e
---

User confirmed on 2026-06-08:

- **`subjectCourse`** = the course identifier and the group key. Also
  what we search Banner against (`txt_subjectcoursecombo`). One
  `subjectCourse` value = one chip in COURSES.
- **`courseReferenceNumber` (CRN)** = uniquely identifies each INSTANCE
  of a course — different days, different sections, etc.

**Why:** I had spent 5 commits trying to "fix" the case where multiple
searched codes (PROJ309, CPRG305, CPSY300, ITSC320 capstone) supposedly
collapsed to one chip because Banner returned them all under one
canonical `subjectCourse`. The user clarified this isn't how Banner
behaves — `subjectCourse` IS reliable per search, and there's no
canonical-label collapsing to compensate for.

**How to apply:** Never introduce CRN-dedup in `byCourses`, never
override `subject`/`courseNumber`/`subjectCourse` on returned sections,
never add an alias-collapsing step in the scheduler. Group by
`section.subjectCourse` as Banner returns it. If the user reports
N searched codes producing < N chips, the right next step is to
inspect what Banner actually returned for each search call, NOT to
patch the parser/scheduler.

Related: [[parser-dedupe-unsafe]]
