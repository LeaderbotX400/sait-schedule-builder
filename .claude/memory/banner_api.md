---
name: banner-api-facts
description: Non-obvious SAIT Banner API behaviors — junk terms in getTerms, meetingTimes shape differences, sponsored registrations missing from getRegistrationEvents
metadata:
  type: project
---

Banner wire facts that aren't derivable from the SDK code (the SDK itself — hosts, endpoints, priming dance, error taxonomy — is documented in CLAUDE.md and pinned by `src/banner-sdk/tests/`):

- **`getTerms` returns many non-enrollable terms** (descriptions containing `(View Only)`, `Non-Credit`, `Apprentice`), newest-first. Finding the student's real active term means skipping those and taking the first remaining entry.
- **Meeting-times shape differs by endpoint.** `searchResults` nests them as `section.meetingsFaculty[].meetingTime`; `renderActiveRegistrations` has a flat `registration.meetingTimes[]`. Both entries share the same `BannerMeetingTime` shape (beginTime/endTime, monday–sunday booleans, building, room, campus).
- **`getRegistrationEvents` only includes `**Web Registered**` courses** — registrations with `*Registered-Sponsored` status appear in `renderActiveRegistrations` but NOT here. It also lacks building/room/instructor. Only useful as a quick session-validity check.
- The registration response carries no enrollment/seat data, which is why `parseActiveRegistrations` zeroes those fields.

Related: [[sait-data-model]], [[parser-dedupe-unsafe]]
