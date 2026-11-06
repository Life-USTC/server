# Teaching-section card comparison

Four screenshots captured on November 6, 2026 with Chromium 153.0.8010.0, DPR 1, at 390 × 1100 (English) and 768 × 1100 (Chinese). These render the actual `SectionsResults`, `CourseDetailSectionsMobile` and `TeacherDetailSectionsMobile` Svelte components in a temporary standalone fixture, with the existing Tooltip provider and product stylesheet.

The fixture uses one synthetic public course/section, locale-projected primary/secondary names and the same parent teacher context. It also renders the delivered identity component with missing optional fields and a long code. No account, database or application API was accessed. Navigation exports are fixture stubs; these images do not establish route navigation, authentication, API or production acceptance. Noto Sans SC is supplied by the QA host for complete Chinese rendering; this does not change product font assets.

Before components are the unmodified source from `c81d63af` (the parent of the card change). After components are the reviewed worktree source; `SectionCardIdentity.svelte` blob is `198eac64419cbe88800f4ad8e1d00a5d1fc435a2`. The same data and viewport are used in each pair.

| Width / locale | Before | After |
| --- | --- | --- |
| 390 / English | [Before](before-en-us-390.png) | [After](after-en-us-390.png) |
| 768 / Chinese | [Before](before-zh-cn-768.png) | [After](after-zh-cn-768.png) |

Visual review confirms the same course → available teacher context → subordinate code/semester order across all three cards. The long English name and missing-context code wrap into visible lines, metadata remains legible, and no title or code is cut off. All four renderings had zero page errors. Recorded document scroll widths are 375 and 753 pixels respectively (the remaining 15 pixels are the browser scrollbar), within their viewports. `geometry.json` retains rendered text and component bounds; visual inspection is the primary evidence for readability.
