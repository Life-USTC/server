# Home activity range comparison

Chromium 153, DPR 1, November 6, 2026. These screenshots crop the activity section of the actual HomePageController mounted with its shared components, full product stylesheet, Tooltip provider and anonymous shell context. Before is unmodified main d9c7993a; after component blob is f3cf9ed7e400f90c84d8556abf23238e66e658fd. Both use the same five synthetic cross-month activities plus two later starts; the original bounded start-order prefix only contains the cross-month records. The first synthetic range mirrors the public date shape observed during the live audit, August 19, 2026 to January 2, 2027; it is not account data.

| Viewport / locale     | Before                          | After                         |
| --------------------- | ------------------------------- | ----------------------------- |
| 390 × 1100 / Chinese  | [Before](before-zh-cn-390.png)  | [After](after-zh-cn-390.png)  |
| 1440 × 1100 / English | [Before](before-en-us-1440.png) | [After](after-en-us-1440.png) |

The homepage's actual columns measure 343 and 505 pixels in these viewports. Visual review confirms that starts today or later lead, cross-day ranges have a separate neutral heading, and both ends remain readable. The formatter is the same youngDateRange used by activity detail and organizer surfaces; same-day ranges do not repeat the date. The page title no longer calls cross-month records upcoming.

Eight renderings (before/after × Chinese/English × 390/1440) had zero page errors and zero non-loopback browser requests. The section scroll width equals its client width. The phone shows up to three rows per group, wide layouts up to five, using the existing breakpoint/row limits. Both groups retain exact detail links and the full directory link. A QA-only same-origin Noto Sans SC font supplies Chinese glyphs without changing product assets.

This temporary standalone Svelte/Tailwind fixture stubs anonymous identity and campus-now responses and blocks non-loopback traffic. It establishes rendered hierarchy and links, not actual SvelteKit routing, authentication, database selection or production acceptance. The loader's updated existing unit case checks two bounded public-list calls with the activity time basis, active filter and matching Shanghai midnight boundary; existing Young filtering and date-format tests also pass. No fixture, diagnostic script, dependency, new test case or check framework ships with the product. Current-head CI is still required. Calendar day-view semantics and the remainder of #1430 are not completed by this homepage slice.
