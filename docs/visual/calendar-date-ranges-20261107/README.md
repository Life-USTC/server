# Calendar date ranges

Matched Chromium 153 before/after, Chinese 390 x 1100 and English 1280 x 1100, November 7, 2026. The original YoungCalendar component blob is cd6c99550dbb077fde1c3a9610555511ea1c8266 (unchanged between d9c7993a and the branch base 4e85f30f). Both phases use the same synthetic lecture, start-only record, overnight range, and August-to-January activity. Names and locations are deliberately long. Images contain no account data.

| View | Before | After |
| --- | --- | --- |
| Chinese phone | [Before](before-zh-cn-390.png) | [After](after-zh-cn-390.png) |
| English desktop | [Before](before-en-us-1280.png) | [After](after-en-us-1280.png) |

Actual YoungCalendar and shared components use product CSS in a temporary standalone Svelte server-render and hydrate fixture. Eight matched renders cover Chinese/English at 390/1280. Four additional renders cover registration-day (with deliberately different registration timestamps), activity-month/week, and empty-day inputs. All twelve have zero page errors, console warnings, and non-loopback requests. Both responsive day layouts use the same rows, retain exact event links, and show neutral time/date groups. Cross-day ranges include both dates; partial endpoints are labelled. After-image title/time/location rows have no clipped text, unlike the original phone rows.

Registration mode renders the synthetic 09:00-10:00 registration window and November 6-10 range, rather than their different activity timestamps. Conflicts and source-missing notes remain. Month/week retain their existing start-only membership, row limits, more links, and earlier-date expansion. A supplied missing-start/end-only record stays excluded by the unchanged calendar membership; this fixture does not claim to render unknown-start records. The route's existing unknown-date discovery owns them.

The fixture has no full application server, Worker, external font, database, account, or production connection. It does not prove real routing, database query selection, authentication, permissions, production bundling, or deployment. Fonts are QA-only same-origin Noto Sans SC; no fixture, script, dependency or test framework ships. The phone toolbar's pre-existing truncated date heading is outside this change. Existing unit cases and specification validation supplement, but do not replace, the retained visual comparison. Full current-head CI remains required; #1430 stays open pending the calendar and production acceptance.
