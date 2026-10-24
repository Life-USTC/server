import type { TableFilterField, TableFilterLabels } from "@/lib/table-filters";
import type {
  AdminModerationCopy,
  AdminModerationTab,
} from "../components/admin-moderation-page-types";

export function moderationTableFields(
  tab: AdminModerationTab,
  copy: AdminModerationCopy,
  labels: TableFilterLabels,
) {
  const booleanOptions = [
    { value: "true", label: labels.yes },
    { value: "false", label: labels.no },
  ];
  const fields: Record<string, TableFilterField[]> = {
    content: [
      {
        name: "content",
        label: tab === "homeworks" ? copy.homeworkTitle : copy.content,
      },
      ...(tab === "homeworks" ? [{ name: "author", label: copy.author }] : []),
    ],
    author: [
      {
        name: "author",
        label: tab === "suspensions" ? copy.user : copy.author,
      },
      ...(tab === "comments"
        ? [
            {
              name: "isAnonymous",
              label: copy.anonymousLabel,
              options: booleanOptions,
            },
          ]
        : []),
    ],
    target: [
      {
        name: "target",
        label: tab === "homeworks" ? copy.homeworkSection : copy.postedIn,
      },
    ],
    createdAt: [{ name: "createdAt", label: copy.createdAt, type: "date" }],
    editedAt: [{ name: "editedAt", label: copy.editedAtLabel, type: "date" }],
    dueAt: [{ name: "dueAt", label: copy.homeworkDue, type: "date" }],
    reason: [{ name: "reason", label: copy.reason }],
    expiresAt: [
      { name: "expiresAt", label: copy.expires, type: "date" },
      { name: "permanent", label: copy.permanent, options: booleanOptions },
    ],
    descriptionContent: [
      { name: "content", label: copy.descriptionPreview },
      {
        name: "descriptionContent",
        label: copy.descriptionContent,
        options: [
          { value: "withContent", label: copy.descriptionContentWith },
          { value: "empty", label: copy.descriptionContentEmpty },
        ],
      },
    ],
    descriptionTarget: [
      { name: "target", label: copy.postedIn },
      {
        name: "descriptionTarget",
        label: copy.descriptionTarget,
        options: [
          { value: "course", label: copy.descriptionTargetCourse },
          { value: "section", label: copy.descriptionTargetSection },
          { value: "teacher", label: copy.descriptionTargetTeacher },
          { value: "homework", label: copy.descriptionTargetHomework },
        ],
      },
    ],
    status: [
      {
        name: "status",
        label: copy.status,
        options:
          tab === "suspensions"
            ? [
                { value: "active", label: copy.active },
                { value: "lifted", label: copy.lifted },
              ]
            : tab === "homeworks"
              ? [
                  { value: "active", label: copy.homeworkStatusActive },
                  { value: "deleted", label: copy.homeworkStatusDeleted },
                ]
              : [
                  { value: "active", label: copy.statusActive },
                  { value: "softbanned", label: copy.statusSoftbanned },
                  { value: "deleted", label: copy.statusDeleted },
                  { value: "suspended", label: copy.filterSuspended },
                ],
      },
    ],
  };
  const extras: TableFilterField[] =
    tab === "comments"
      ? [{ name: "note", label: copy.moderationNote }]
      : tab === "suspensions"
        ? [
            { name: "createdAt", label: copy.createdAt, type: "date" },
            { name: "note", label: copy.moderationNote },
          ]
        : [];
  return { fields, extras };
}
