import { isHomeworkPendingForViewer } from "@/features/homeworks/lib/homework-completion-state";
import { splitRoomLabels } from "@/features/rooms/lib/room-map-types";
import { matchTableFilter, type TableFilterField } from "@/lib/table-filters";
import { formatShanghaiDate } from "@/lib/time/shanghai-format";
import { namePrimary } from "./localized-names";
import { sortTodosByDeadline } from "./todo-list-state";
import type {
  ExamRow,
  WorkspaceHomeworkItem,
  WorkspaceRootCopy,
  WorkspaceTodoItem,
} from "./workspace-controller-types";

function options(values: (string | null | undefined)[]) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))]
    .sort()
    .map((value) => ({ value: encodeURIComponent(value), label: value }));
}

function optionValue(value: string | null | undefined) {
  return value == null ? null : encodeURIComponent(value);
}

function dateValue(value: unknown) {
  return typeof value === "string" || value instanceof Date
    ? formatShanghaiDate(value)
    : null;
}

function timeValue(value: number | null) {
  if (value == null) return null;
  const padded = String(value).padStart(4, "0");
  return `${padded.slice(0, 2)}:${padded.slice(2)}`;
}

export function todoTableFields(
  copy: Pick<WorkspaceRootCopy, "todos">,
): TableFilterField[] {
  const c = copy.todos;
  return [
    { name: "title", label: c.titleLabel },
    {
      name: "priority",
      label: c.priorityLabel,
      options: Object.entries(c.priority).map(([value, label]) => ({
        value,
        label,
      })),
    },
    { name: "dueAt", label: c.dueAtLabel, type: "date" },
    {
      name: "completion",
      label: c.statusLabel,
      options: [
        { value: "incomplete", label: String(c.filterIncomplete) },
        { value: "completed", label: String(c.filterCompleted) },
      ],
    },
    { name: "content", label: c.contentLabel },
  ];
}

export function filterTodoTable(
  rows: WorkspaceTodoItem[],
  fields: TableFilterField[],
  values: Record<string, string>,
) {
  return sortTodosByDeadline(
    rows.filter((row) =>
      fields.every((field) => {
        const value =
          field.name === "completion"
            ? row.completed
              ? "completed"
              : "incomplete"
            : field.name === "dueAt"
              ? dateValue(row.dueAt)
              : row[field.name];
        return matchTableFilter(
          typeof value === "string" ? value : null,
          field,
          values,
        );
      }),
    ),
  );
}

export function homeworkTableFields(
  copy: Pick<WorkspaceRootCopy, "homeworks" | "common">,
  rows: WorkspaceHomeworkItem[],
): TableFilterField[] {
  const c = copy.homeworks;
  return [
    {
      name: "course",
      label: c.sectionLabel,
      options: options(rows.map((row) => row.section?.courseName)),
    },
    {
      name: "semester",
      label: copy.common.semesters,
      options: options(rows.map((row) => row.section?.semesterName)),
    },
    { name: "title", label: c.titleLabel },
    { name: "submissionDueAt", label: c.submissionDue, type: "date" },
    {
      name: "completion",
      label: c.statusLabel,
      options: [
        { value: "incomplete", label: c.filterIncomplete },
        { value: "completed", label: c.filterCompleted },
        { value: "advisory", label: c.noCompletionRequired },
        { value: "overdue", label: c.overdueLabel },
      ],
    },
    {
      name: "flags",
      label: c.statusLabel,
      options: [
        { value: "major", label: c.tagMajor },
        { value: "team", label: c.tagTeam },
      ],
    },
    {
      name: "section",
      label: copy.common.sections,
      options: options(rows.map((row) => row.section?.code)),
    },
    { name: "publishedAt", label: c.publishedAt, type: "date" },
    { name: "submissionStartAt", label: c.submissionStart, type: "date" },
    { name: "description", label: c.descriptionLabel },
  ];
}

export function filterHomeworkTable(
  rows: WorkspaceHomeworkItem[],
  fields: TableFilterField[],
  values: Record<string, string>,
  now: Date,
) {
  return rows.filter((row) =>
    fields.every((field) => {
      let value: string | string[] | null = null;
      switch (field.name) {
        case "course":
          value = optionValue(row.section?.courseName);
          break;
        case "semester":
          value = optionValue(row.section?.semesterName);
          break;
        case "section":
          value = optionValue(row.section?.code);
          break;
        case "completion":
          value = [
            ...(row.completion ? ["completed"] : []),
            ...(isHomeworkPendingForViewer(row, now) ? ["incomplete"] : []),
            ...(row.completionRequired === false ? ["advisory"] : []),
            ...(!row.completion &&
            row.completionRequired !== false &&
            row.submissionDueAt &&
            new Date(row.submissionDueAt) < now
              ? ["overdue"]
              : []),
          ];
          break;
        case "flags":
          value = [
            ...(row.isMajor ? ["major"] : []),
            ...(row.requiresTeam ? ["team"] : []),
          ];
          break;
        default: {
          const raw = row[field.name];
          value =
            field.type === "date"
              ? dateValue(raw)
              : typeof raw === "string"
                ? raw
                : null;
        }
      }
      return matchTableFilter(value, field, values);
    }),
  );
}

export function examTableFields(
  copy: Pick<
    WorkspaceRootCopy,
    "workspace" | "sectionDetail" | "subscriptions" | "common"
  >,
  rows: ExamRow[],
): TableFilterField[] {
  const c = copy.sectionDetail;
  return [
    {
      name: "course",
      label: copy.subscriptions.courseName,
      options: options(rows.map((row) => row.courseName)),
    },
    {
      name: "section",
      label: copy.subscriptions.section,
      options: options(rows.map((row) => row.section.code)),
    },
    {
      name: "semester",
      label: copy.common.semesters,
      options: options(rows.map((row) => namePrimary(row.section.semester))),
    },
    { name: "examDate", label: c.examDate, type: "date" },
    {
      name: "completion",
      label: c.examDate,
      options: [
        {
          value: "incomplete",
          label: copy.workspace.nav.exams.filterIncomplete,
        },
        { value: "completed", label: copy.workspace.nav.exams.filterCompleted },
      ],
    },
    { name: "startTime", label: String(c.examStartTime), type: "time" },
    { name: "endTime", label: String(c.examEndTime), type: "time" },
    {
      name: "examMode",
      label: String(c.examMode),
      options: options(rows.map((row) => row.examMode)),
    },
    {
      name: "rooms",
      label: c.room,
      options: options(rows.flatMap((row) => splitRoomLabels(row.rooms))),
    },
    {
      name: "examType",
      label: String(c.examType),
      options: [
        { value: "1", label: c.examTypeMidterm },
        { value: "2", label: c.examTypeFinal },
      ],
    },
    {
      name: "examBatch",
      label: String(c.examBatch),
      options: options(rows.map((row) => namePrimary(row.examBatch))),
    },
    {
      name: "examTakeCount",
      label: c.examCount,
      type: "number",
      min: 0,
      step: 1,
    },
  ];
}

export function filterExamTable(
  rows: ExamRow[],
  fields: TableFilterField[],
  values: Record<string, string>,
) {
  return rows.filter((row) =>
    fields.every((field) => {
      let value: string | number | string[] | null;
      switch (field.name) {
        case "course":
          value = optionValue(row.courseName);
          break;
        case "section":
          value = optionValue(row.section.code);
          break;
        case "semester":
          value = optionValue(namePrimary(row.section.semester));
          break;
        case "examDate":
          value = dateValue(row.examDate);
          break;
        case "completion":
          value = row.completed ? "completed" : "incomplete";
          break;
        case "startTime":
          value = timeValue(row.startTime);
          break;
        case "endTime":
          value = timeValue(row.endTime);
          break;
        case "examMode":
          value = optionValue(row.examMode);
          break;
        case "rooms":
          value = splitRoomLabels(row.rooms).map(encodeURIComponent);
          break;
        case "examType":
          value = row.examType;
          break;
        case "examBatch":
          value = optionValue(namePrimary(row.examBatch));
          break;
        default:
          value = row.examTakeCount;
      }
      return matchTableFilter(value, field, values);
    }),
  );
}
