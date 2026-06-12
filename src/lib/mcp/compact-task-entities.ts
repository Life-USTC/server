import { isRecord } from "@/lib/utils";
import { compactSection } from "./compact-academic-entities";
import { compactUser } from "./compact-base-entities";
import { compactRelations, pick, transferScalarKeys } from "./compact-helpers";

export function compactTodo(value: unknown) {
  if (!isRecord(value)) return value;
  const base = pick(value, [
    "id",
    "title",
    "priority",
    "dueAt",
    "completed",
    "createdAt",
    "updatedAt",
  ]);
  if (!value.completed && Object.hasOwn(value, "content")) {
    return { ...base, content: value.content };
  }
  return base;
}

export function compactHomework(value: unknown) {
  if (!isRecord(value)) return value;
  return {
    ...pick(value, [
      "id",
      "sectionId",
      "title",
      "isMajor",
      "requiresTeam",
      "publishedAt",
      "submissionStartAt",
      "submissionDueAt",
      "deletedAt",
      "createdAt",
      "updatedAt",
    ]),
    ...compactRelations(value, {
      description: (v) =>
        isRecord(v)
          ? pick(v, ["id", "content", "lastEditedAt", "lastEditedById"])
          : v,
      section: compactSection,
      createdBy: compactUser,
      updatedBy: compactUser,
      deletedBy: compactUser,
    }),
    ...transferScalarKeys(value, [
      "completion",
      "commentCount",
      "homeworkCompletions",
    ]),
  };
}
