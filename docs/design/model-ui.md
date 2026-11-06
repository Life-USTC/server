# Model UI reference

Open [the interactive reference](model-ui.html) directly in a browser. It uses
synthetic examples and makes no network requests or business writes. This is a
visual reference, not a new product screen or proof of production acceptance.
The [desktop comparison](model-ui-desktop.png) and [mobile homework form](model-ui-homework-mobile.png)
were rendered in Chromium with a local CJK font for review; the font is not a
repository dependency.

The existing [UI policy](../policies/ui.yaml), [permission policy](../policies/permission-ui.yaml)
and feature field declarations remain the requirement owners. This reference
makes their composition visible instead of introducing another field registry.

| Model    | Identity                                                                                     | Supporting context                                                        | Task state and action                                                                                               |
| -------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Course   | Plain monospace course code as a small eyebrow, then the dominant localized name             | Secondary localized name where applicable, education level and category   | Browse its offerings; a course is not itself a semester subscription                                                |
| Section  | Course name, then teachers; keep the same order in cards, subscription selection and details | Section code in plain monospace, semester, campus, credits when available | Subscription state is separate from identity; subscribe to this specific offering                                   |
| Homework | Homework title                                                                               | Linked section context, tags and other published facts                    | Absolute due date/time and own completion state remain visible across entry points; relative urgency is subordinate |

The compact rows and detail headers use the same identity fragment. The
reference's course detail offerings keep the section identity used in discovery
and subscription confirmation, including its course name. A section code never
replaces the title. Existing semester-grouped history behavior remains owned by
the feature policy rather than this illustrative offering card.

Detail reading follows the existing responsive policy: hero, compact identity
facts, reading stream, remaining facts on a narrow screen; reading stream and
structured facts beside each other only when both have useful width. Long names
wrap in cards and headers. A table may truncate only with its existing complete
text interaction. Internal row IDs and JW retrieval IDs do not become UI labels.

Subscription confirmation keeps the selected section's name, teachers, code and
semester together above the disclaimer. Anonymous users can browse the same
public identity and sign in with a return destination. Signed-in users see their
own subscription state. Read-only users receive a visible reason beside the
disabled write action; no state-specific variant changes the identity order.

Homework creation uses one field composition in workspace and section entry:
section context → title → due date/time → description → major/team flags →
optional publication/submission-open times. A section entry fixes the context;
a workspace entry selects it. Both show the chosen section before editable
fields. Writing guidance stays collapsed, flags stay outside optional time
settings, and the same available shortcut carries the same meaning. Missing
schedule data must not be replaced with invented next-class shortcuts.

Homework details retain one scroll viewport, a visible title and reachable
completion/edit actions. The same authorized user must not lose completion,
editing or history access just by entering through workspace instead of a
section. Anonymous/read-only views must not label another user's completion as
their own. Actual permission checks remain server-owned.

For review, compare the same entity and viewer at 390, 768, 1024 and 1440 CSS
pixels, then inspect a long localized title, missing teacher, signed-out state
and read-only state. Open the subscription and homework flows from both entry
points. Check text boundaries, scrolling, keyboard focus and back navigation by
using them; screenshots support this review but do not establish persistence,
permissions, native behavior or a real production authorization flow.
