# Teaching-section detail summary

Actual `SectionDetailHeader`, `PageHeader` and action components, Chromium 153, DPR 1. Before is main `1a0a1abf`; after is the proposed header change. The same synthetic long course, code and two-teacher context is used on both sides.

| Viewport / locale    | Before                          | After                         |
| -------------------- | ------------------------------- | ----------------------------- |
| 390 × 700 / English  | [Before](before-en-us-390.png)  | [After](after-en-us-390.png)  |
| 1280 × 700 / Chinese | [Before](before-zh-cn-1280.png) | [After](after-zh-cn-1280.png) |

The course heading leads, teacher context follows, and the quiet monospace code wraps before the semester. The code is no longer an eyebrow preceding the name. Missing optional teacher/semester fields leave no invented labels; a missing course name uses the code once as a wrapping monospace heading. Existing subscription role, historical notice and management link remain visible in their controlled fixture state.

All four comparisons use actual server-rendered Svelte HTML followed by client hydration, not a client-only mount. Missing-field, missing-name and subscribed/historical states were also hydrated. There were no page errors, hydration warnings or external requests. At desktop both calendar and subscription controls still invoked their existing callbacks once; phone action visibility is unchanged. The same-origin QA host supplies Noto Sans SC for legible Chinese, without changing product fonts. Document scroll width stays within the viewport.

This is a temporary pure Svelte/Tailwind fixture with locale/form behavior controlled locally and non-loopback browser requests blocked. It establishes component rendering and callback behavior, not real SvelteKit route execution, Worker production bundling, authentication, database or overall pinned-layout acceptance. Original teacher links and extended rail remain owned by the page. Their actual data ownership was reviewed separately; full current-head CI remains required. No harness, new test, dependency or configuration ships in this change.
