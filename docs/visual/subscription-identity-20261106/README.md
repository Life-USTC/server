# Subscription identity comparison

Actual Svelte components, Chromium 153, DPR 1, November 6, 2026. Before uses unmodified main `d9c7993a`; after uses the reviewed shared identity and four subscription entry points. The shared `SectionCardIdentity.svelte` blob is `c2a051b7f6c2385f71edbf51a360c7b15e882a08`. Identical synthetic courses, teacher context, section codes and semester are used before/after. Workspace cards receive only the names supplied by their existing read model; the fixture does not invent a secondary course name or teachers. A QA-only same-origin Noto Sans SC font supplies Chinese glyphs without changing product assets.

| Entry / viewport                 | Before                                  | After                                 |
| -------------------------------- | --------------------------------------- | ------------------------------------- |
| Subscribed cards / English 390   | [Before](before-cards-en-us-390.png)    | [After](after-cards-en-us-390.png)    |
| Quick add / English 390          | [Before](before-quick-en-us-390.png)    | [After](after-quick-en-us-390.png)    |
| Bulk confirmation / Chinese 1024 | [Before](before-bulk-zh-cn-1024.png)    | [After](after-bulk-zh-cn-1024.png)    |
| Welcome import / Chinese 1024    | [Before](before-welcome-zh-cn-1024.png) | [After](after-welcome-zh-cn-1024.png) |

Visual review confirms course → available teachers → subordinate monospace code and semester in all four entries. Long workspace names now wrap completely rather than being clipped beside the action icons; subscription role, credits and actions follow the identity. Selection checkboxes remain beside their content; campus follows identity. Missing teachers are omitted as in the shared catalog card, not invented.

Before rendering used a standalone component mount. Final after rendering used actual Svelte server render followed by browser hydration for all four entries at English 390 and Chinese 1024. All eight final after scenes completed hydration with zero console/page errors, no external browser requests and no horizontal document overflow. The SSR fixture compiles the product UI components and stylesheet, without SvelteKit or the Cloudflare adapter. It does not establish real route, authentication, database or production acceptance.

Interactions after hydration retain workspace section href `/catalog/sections/42` and role-edit callback ID `7`; quick-add selection submits `[7]` to its synthetic callback; clicking the existing bulk/welcome visible labels clears and restores the same checkbox ID. An additional read-only card SSR/hydration scene retained both exact course links and disabled all four mutating action buttons, with no browser error or external request. The existing production selection and mutation functions are unchanged. Temporary fixtures, callback controls and reports are not shipped. No dependency, new test case or check framework is introduced. Current-head application CI remains the full-route/database gate.
