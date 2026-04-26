---
name: Banner API Architecture
description: How SAIT's Banner Self-Service API works, including auth, proxy setup, key endpoints, and response formats
type: project
---

## Auth & Proxy

All Banner requests go through a Vite dev-server proxy at `/api/banner` → `https://sait-sust-prd-prd1-ban-ss-ssag6.sait.ca/StudentRegistrationSsb`.

Because browsers block the `Cookie` header on `fetch`, credentials are sent as custom headers that the proxy rewrites:
- `X-Banner-Cookies` → `Cookie`
- `X-Banner-Sync-Token` → `X-Synchronizer-Token`
- `X-Banner-Referer` → `Referer`
- `X-Banner-Origin` → `Origin` (POST endpoints only)

Credentials come from either:
1. The Chrome extension (reads `chrome.cookies` + cached sync token from a page visit)
2. Manual header paste (user copies raw request headers from DevTools)

Both paths go through `validateCredentials` before being accepted.

## Key Endpoints

### Term list
`GET /ssb/classSearch/getTerms?searchTerm=&offset=1&max=20`
Returns all terms newest-first. **Many are non-enrollable** (View Only, Non-Credit, Apprentice). To find the student's current active term, skip any description containing `(View Only)`, `Non-Credit`, or `Apprentice` and take the first remaining entry.

### Student's registered courses
`GET /ssb/registrationHistory/renderActiveRegistrations?term=XXXXXX`
Returns `{ data: { registrations: ActiveRegistration[] } }`.
Each `ActiveRegistration` has: `subject`, `courseNumber`, `courseTitle`, `courseReferenceNumber` (CRN), `sequenceNumber`, `creditHour`, `instructionalMethodDescription`, `meetingTimes[]` (same shape as `BannerMeetingTime`), `faculty[]`, `instructorNames[]`, `courseRegistrationStatusDescription`.

**Important:** `meetingTimes` is a flat array (not wrapped in `meetingsFaculty`), unlike the search results format. Courses with `*Registered-Sponsored` status appear here but NOT in `getRegistrationEvents`.

### Course section search (all available sections)
`GET /ssb/searchResults/searchResults?txt_subjectcoursecombo=CPRG307&txt_term=202540&...`
Returns `BannerResponse { success, totalCount, data: BannerSection[] }`.
**Session-stateful** — must call `initializeTermSession` (4-step sequence) before EACH search code.

### Calendar events (limited)
`GET /ssb/classRegistration/getRegistrationEvents?termFilter=`
Returns an array of calendar event objects with `start`/`end` ISO timestamps, `crn`, `subject`, `courseNumber`, `title`. Only includes `**Web Registered**` courses (filters out sponsored registrations). Fewer fields than `renderActiveRegistrations` — no building, room, or instructor. Useful as a quick session validity check.

### Session initialization (required before course search)
Four-step sequence per course code:
1. `GET /ssb/userPreference/fetchUsageTracking`
2. `GET /ssb/term/saveTerm?mode=registration&term=...&uniqueSessionId=...`
3. `POST /ssb/term/search?mode=registration` with form body
4. `GET /ssb/userPreference/fetchUsageTracking` again

Not required for `renderActiveRegistrations` or `getTerms`.

## Response Format Differences

| Endpoint | Meeting times field | Wrapper |
|---|---|---|
| `searchResults` | `section.meetingsFaculty[].meetingTime` | `BannerResponse.data[]` |
| `renderActiveRegistrations` | `registration.meetingTimes[]` | `data.registrations[]` |

Both `meetingTime` / `meetingTimes` entries share the same `BannerMeetingTime` shape (beginTime, endTime, monday–sunday booleans, building, room, campus, etc.).

## Parsers

- `parseBannerData(response)` → `Map<subjectCourse, CourseSection[]>` (from search results)
- `parseActiveRegistrations(registrations)` → `Map<subjectCourse, CourseSection[]>` (one section per course, from registration data)

**Why:** `parseActiveRegistrations` sets `isCurrentRegistration: true` on each section and marks enrollment/seat fields as 0 since that data isn't in the registration response.
