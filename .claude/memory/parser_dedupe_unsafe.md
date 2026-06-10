---
name: parser-dedupe-unsafe
description: Why parser-level meeting/section dedupe (by days|start|end|building|room) is unsafe in SAIT Banner data. Confirmed via real PROJ309 Fall 2026 response on 2026-06-08.
metadata: 
  node_type: memory
  type: project
  originSessionId: bcb34a27-3b7a-4338-9e9c-acb1de9b2742
---

Parser-level dedupe of Banner sections or meeting blocks by a time/place
composite key is UNSAFE — confirmed on 2026-06-08 against real Banner
data at `/tmp/schedule-builder/proj309-reference.json`.

**Why:** Real PROJ309 Fall 2026 response shows 10 sections, all with
unique CRNs and `meetingsFaculty.length=1`. Two of those sections
legitimately collide on `(days, start, end, building, room, meetingType,
startDate, endDate)`:

- PROJ309/ITB (CRN 21945) and PROJ309/SDC (CRN 21950) both meet
  Tuesday 0800-1050 in MB019 / MD215 respectively — same time, same
  building tag, etc.

Any cross-section dedupe keyed on time/place would erroneously collapse
these into one section. Students can enroll in either, so collapsing
loses real options.

Within a single section, `meetingsFaculty.length` is 1 in every
observed entry — there's no within-section duplication to dedupe in
practice. The original symptom 21b2d81 was chasing ("50+ React
duplicate-key warnings every 10s") was never reproduced against real
data after the rollback, and may have been a render-layer key collision
between distinct sections that happened to share a time-key.

**How to apply:**
- Do NOT add `dedupeMeetings()` by time/place key in `src/domain/parser.ts`
  at section level or registration level. 21b2d81 was rolled back and
  should stay rolled back.
- Do NOT add cross-section dedupe in `parseBannerData` either —
  different sections at the same time/place are real.
- For duplicate-key warnings, fix in the RENDER layer with a
  uniquely-qualified `:key` like `${section.crn}-${idx}` for meetings
  within a section, or `${section.crn}` for sections in a list.
- If a CRN appears twice in `response.data` or in `registrations[]`
  from Banner, THAT is the case where CRN-level dedupe is safe — but
  no real evidence we've seen that happens.

The user surfaced this on 2026-06-08 while reviewing the post-reset
replay: "We should be able to dedupe by courseReferenceNumber as that
is unique to the entry! Time may overlap with other instances of other
courses or even within the same one!" Then provided the PROJ309
reference JSON, which confirms the collision case.

Related: [[sait-data-model]]
