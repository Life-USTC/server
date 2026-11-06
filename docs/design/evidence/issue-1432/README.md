# Homework editor comparison

Related to [#1432](https://github.com/Life-USTC/server/issues/1432) and the
[model UI reference](https://github.com/Life-USTC/server/pull/1476).

The workspace and section creation entry points now render the same existing
`HomeworkEditorFields` component. Title, due date, description and major/team
flags have the same order; optional timestamps and advisory writing guidance
start collapsed. The selected workspace section has a complete wrapping summary.
The section remains fixed when creation starts from its detail page.

Both entries use the existing Shanghai-time shortcut builder. Section creation
and editing receive the section's actual schedule starts, while workspace
creation receives its selected section's existing starts. Missing schedules do
not produce invented next-class suggestions. Workspace now also offers the same
week/month and semester-start actions already available in the section editor.

Workspace compact homework details link to the canonical section URL with the
specific `homeworkId`, preserving access to the full editor and history instead
of introducing a second editing controller. Long detail context wraps, and
footer actions can wrap on narrow screens.

## Local visual observations

The images compare baseline `c81d63af79bfb670b78e5f53952c9ca4994d7c4c`
with this branch using the same synthetic section, title and description.
These are real repository Svelte components rendered with their real UI
primitives and stylesheet. Only page locale, form enhancement and the discussion
fixture are supplied locally. No account, database, authenticated request or
business write is involved; these observations do not establish full Web or
production acceptance.

The implementation was compared with the prototype before visual review.
English and Chinese at 390, 768 and 1440 pixels covered workspace creation,
section creation and workspace detail. The 18 local renderings had no page
exceptions; dialog and scroll-viewport scroll/client widths matched. Representative
images were also inspected for complete context text and control boundaries.
Both creation entries exposed the
same 12 available shortcut labels for the matched schedule, expanded optional
timestamps and naming guidance, and retained the entered title, description,
due date and checked major flag in native FormData. The workspace alone included
the selected section identifier. Detail links retained the exact synthetic
homework identifier and `#homework` anchor.

Screenshots support review of text hierarchy and bounds. Actual permission
projections, persisted create/edit/completion flows, production navigation and
the remaining #1432 outcomes require the full application checks.

| Entry / viewport  | Before                                                         | After                                                        |
| ----------------- | -------------------------------------------------------------- | ------------------------------------------------------------ |
| Workspace, 390px  | ![Workspace before at 390px](before-workspace-en-us-390.png)   | ![Workspace after at 390px](after-workspace-en-us-390.png)   |
| Workspace, 1440px | ![Workspace before at 1440px](before-workspace-en-us-1440.png) | ![Workspace after at 1440px](after-workspace-en-us-1440.png) |
| Section, 390px    | ![Section before at 390px](before-section-en-us-390.png)       | ![Section after at 390px](after-section-en-us-390.png)       |

Additional observations: [full-details link and footer](after-detail-en-us-390.png)
and [the bounded deadline menu](after-workspace-en-us-390-deadlines.png).

A focused follow-up retained the section's actual audit-record header button.
Both mobile creation footers occupy y=700–828 inside the 844px viewport, with
Create and Cancel readable. After scrolling through the optional fields and
opening the shortcut menu, choosing the next actual class set both entries to
`2026-11-09T08:00` in Shanghai time. The menu occupied x=0–287 inside the 390px
viewport, with equal scroll/client widths. These are local component observations.
