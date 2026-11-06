# Homework personal-state consistency

Actual workspace cards/table, section list and shared detail dialog, Chromium 153, DPR 1, November 6, 2026. Before uses unchanged homework components from `d9c7993a`; after uses this PR. The same synthetic records include pending overdue work, completed overdue work, a teaching-assistant item and an item without a deadline. The clock is fixed at November 6, 2026, 12:00 UTC. Both use the product stylesheet and a same-origin QA-only Noto Sans SC font; no product font asset changes.

| Same viewport / data                    | Before                                           | After                                          |
| --------------------------------------- | ------------------------------------------------ | ---------------------------------------------- |
| Workspace and section, English 390px    | [Before](before-en-us-390.png)                   | [After](after-en-us-390.png)                   |
| Workspace and section, Chinese 1440px   | [Before](before-zh-cn-1440.png)                  | [After](after-zh-cn-1440.png)                  |
| Anonymous shared detail, Chinese 1440px | [Before](before-detail-anonymous-zh-cn-1440.png) | [After](after-detail-anonymous-zh-cn-1440.png) |

Visual review confirms that the title and absolute due date stay intact. Card context uses explicit course, semester and due-date rows without stranded separators. Published major/team flags are separate from personal completion; cards, tables and details reuse the same Pending/Completed/No completion required labels and badge treatment. Missing deadlines keep Pending rather than making TBD the personal state. Completed/advisory items do not regain overdue reminders.

Eight list renderings (before/after × Chinese/English × 390/1440) had no page errors, external requests or horizontal document overflow. The unchanged completion button called a synthetic owner callback once; both lists then showed Completed, hid urgency and retained the due date. The section detail entry selected the exact record. An anonymous section had no personal-state group.

Sixteen detail renderings compared four signed states at 390px and anonymous, unresolved, demo and restricted-account states at 1440px. The anonymous/unresolved/demo inputs previously displayed a fabricated Pending state and overdue reminder; after keeps only published dates/flags. A restricted signed viewer keeps the real Pending/urgency and the original disabled completion action. An already-open detail also reacted to unresolved → resolved → unresolved input without replacing its document. All these renderings had no page errors or external requests.

This temporary standalone Svelte/Tailwind fixture blocks non-loopback requests. It supplies viewer state and records directly, stubs the discussion body and mutation callback, and is not a real sign-in, network recovery, permission, persistence, database or production acceptance run. The product's existing section-personal reader supplies authenticated identity; this PR carries that resolved projection without using write permission as identity. Existing owned browser journeys and their persistence/audit/calendar assertions remain unchanged and await current-head CI. No fixture or diagnostic script ships with the product.
