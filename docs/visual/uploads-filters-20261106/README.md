# Upload filter layout comparison

Actual UploadsPage and shared Svelte components, Chromium 153, DPR 1, November 6, 2026. Before is unmodified main `c81d63af`; after component blob is `e634ef7c6007f7e52bbcdffb0234a565a3253a09`. Both use identical synthetic filenames, sizes, dates and quota data, the product stylesheet and Tooltip provider. A same-origin QA-only Noto Sans SC font supplies Chinese glyphs; no product font asset changed.

| Viewport / locale     | Before                          | After                         |
| --------------------- | ------------------------------- | ----------------------------- |
| 390 × 1100 / Chinese  | [Before](before-zh-cn-390.png)  | [After](after-zh-cn-390.png)  |
| 1440 × 1100 / English | [Before](before-en-us-1440.png) | [After](after-en-us-1440.png) |

Visual review confirms quota precedes the collection panel; all three explicitly labelled fields and the single Apply/Clear pair belong to one toolbar, above the records. Desktop fields share one row; phone fields stack without clipping. Compact cards no longer repeat table-style column controls.

Eight renderings (before/after × Chinese/English × 390/1440) had no page errors, external requests, or horizontal document overflow. The 15-pixel difference between viewport and document client width is the browser scrollbar. All after views have one Apply button and one shared three-field form. Editing filename, size range 1024–4096 and date comparison changes only the draft; Apply calls the stubbed navigation once with all six query keys preserved. Clear empties local inputs and removes the range upper-bound control; its href is `/workspace/uploads` without parameters.

This is a temporary standalone Svelte/Tailwind fixture, with navigation callbacks stubbed and all non-loopback browser requests blocked. It establishes component behavior and navigation arguments, not actual SvelteKit route execution, authentication, ownership, database filtering, or production acceptance. Clear's default link navigation was prevented only by the fixture so its local draft effect could be observed. The existing owned upload-management browser journey retains query, pagination, ownership, reload and write assertions and awaits current-head CI; its obsolete popover steps now address the visible labelled fields. No fixture, dependency, new test case, or diagnostic script ships with the product.
