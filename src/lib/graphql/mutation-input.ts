import {
  TODO_CONTENT_MAX_LENGTH,
  TODO_TITLE_MAX_LENGTH,
} from "@/features/todos/lib/todo-limits";
import type { TodoPriorityValue } from "@/features/todos/lib/todo-priority";
import type {
  CommentReactionType,
  CommentVisibility,
} from "@/generated/prisma/client";
import { badMutationInput } from "./mutation-errors";

export const todoPriorityResolver = {
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
} as const satisfies Record<string, TodoPriorityValue>;

export const commentVisibilityResolver = {
  PUBLIC: "public",
  LOGGED_IN_ONLY: "logged_in_only",
} as const satisfies Record<string, CommentVisibility>;

export const commentReactionTypeResolver = {
  UPVOTE: "upvote",
  DOWNVOTE: "downvote",
  HEART: "heart",
  LAUGH: "laugh",
  HOORAY: "hooray",
  CONFUSED: "confused",
  ROCKET: "rocket",
  EYES: "eyes",
} as const satisfies Record<string, CommentReactionType>;

export const commentTargetTypeResolver = {
  COURSE: "course",
  SECTION: "section",
  TEACHER: "teacher",
  SECTION_TEACHER: "section-teacher",
  HOMEWORK: "homework",
} as const;

export function requireMutationId(value: string, label: string) {
  const normalized = value.trim();
  if (!normalized || normalized.length > 512) {
    badMutationInput(`${label} must be a non-empty ID.`);
  }
  return normalized;
}

export function normalizeTodoTitle(value: string) {
  const normalized = value.trim();
  if (!normalized || normalized.length > TODO_TITLE_MAX_LENGTH) {
    badMutationInput(
      `title must contain 1-${TODO_TITLE_MAX_LENGTH} characters.`,
    );
  }
  return normalized;
}

export function normalizeTodoContent(value: string | null | undefined) {
  if (value == null) return value;
  const normalized = value.trim();
  if (normalized.length > TODO_CONTENT_MAX_LENGTH) {
    badMutationInput(
      `content must not exceed ${TODO_CONTENT_MAX_LENGTH} characters.`,
    );
  }
  return normalized || null;
}

export function normalizeCommentBody(value: string) {
  const normalized = value.trim();
  if (!normalized || normalized.length > 8000) {
    badMutationInput("body must contain 1-8000 characters.");
  }
  return normalized;
}

export function normalizeIdList(
  values: readonly string[] | null | undefined,
  label: string,
) {
  if (values == null) return values;
  return values.map((value) => requireMutationId(value, label));
}

export function dateTimeInput(value: string | null | undefined) {
  if (value == null) return value;
  return new Date(value);
}
