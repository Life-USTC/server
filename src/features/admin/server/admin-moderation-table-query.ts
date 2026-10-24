import type { Prisma } from "@/generated/prisma/client";
import { ilike } from "@/lib/query-filter-helpers";
import { dateTableFilter, tableFilterParams } from "@/lib/table-filter-query";
import { tableFilterValues } from "@/lib/table-filters";
import type { AdminCommentStatusFilter } from "../lib/admin-moderation-filters";
import {
  buildCommentWhere,
  buildDescriptionWhere,
  buildHomeworkWhere,
} from "./admin-moderation-page-filters";

type Filters = Record<string, string>;

export function moderationTableFilters(url: URL) {
  return tableFilterParams(url, [
    "content",
    "author",
    "target",
    "createdAt",
    "createdAtOp",
    "createdAtMax",
    "editedAt",
    "editedAtOp",
    "editedAtMax",
    "dueAt",
    "dueAtOp",
    "dueAtMax",
    "reason",
    "expiresAt",
    "expiresAtOp",
    "expiresAtMax",
    "permanent",
    "isAnonymous",
    "note",
  ]);
}

function userWhere(value: string): Prisma.UserWhereInput {
  return {
    OR: [
      { id: ilike(value) },
      { name: ilike(value) },
      { username: ilike(value) },
    ],
  };
}

function targetWhere(value: string): Prisma.DescriptionWhereInput {
  return {
    OR: [
      { course: { OR: [{ code: ilike(value) }, { nameCn: ilike(value) }] } },
      {
        section: {
          OR: [{ code: ilike(value) }, { course: { nameCn: ilike(value) } }],
        },
      },
      { teacher: { nameCn: ilike(value) } },
      { homework: { title: ilike(value) } },
    ],
  };
}

function commentTargetWhere(value: string): Prisma.CommentWhereInput {
  const target = targetWhere(value);
  return {
    OR: [
      ...(target.OR as Prisma.CommentWhereInput[]),
      {
        sectionTeacher: {
          OR: [
            { section: { code: ilike(value) } },
            { section: { course: { nameCn: ilike(value) } } },
            { teacher: { nameCn: ilike(value) } },
          ],
        },
      },
    ],
  };
}

export function moderationCommentWhere(
  filters: Filters,
): Prisma.CommentWhereInput {
  const conditions: Prisma.CommentWhereInput[] = [];
  const statuses = tableFilterValues(filters.status).filter(
    (value) => value !== "all",
  );
  if (statuses.length)
    conditions.push({
      OR: statuses.map((value) =>
        ["active", "softbanned", "deleted", "suspended"].includes(value)
          ? buildCommentWhere(value as AdminCommentStatusFilter)
          : { id: { in: [] } },
      ),
    });
  if (filters.search)
    conditions.push({
      OR: [
        { id: ilike(filters.search) },
        { body: ilike(filters.search) },
        { authorName: ilike(filters.search) },
        { user: userWhere(filters.search) },
        commentTargetWhere(filters.search),
      ],
    });
  if (filters.content) conditions.push({ body: ilike(filters.content) });
  if (filters.author)
    conditions.push({
      OR: [
        { authorName: ilike(filters.author) },
        { user: userWhere(filters.author) },
      ],
    });
  if (filters.target) conditions.push(commentTargetWhere(filters.target));
  if (filters.note) conditions.push({ moderationNote: ilike(filters.note) });
  if (filters.createdAt)
    conditions.push({ createdAt: dateTableFilter(filters, "createdAt") });
  if (filters.isAnonymous)
    conditions.push({
      OR: tableFilterValues(filters.isAnonymous).flatMap(
        (value): Prisma.CommentWhereInput[] =>
          value === "true"
            ? [{ isAnonymous: true }]
            : value === "false"
              ? [{ isAnonymous: false }]
              : [],
      ),
    });
  return conditions.length ? { AND: conditions } : {};
}

export function moderationDescriptionWhere(
  filters: Filters,
): Prisma.DescriptionWhereInput {
  const conditions: Prisma.DescriptionWhereInput[] = [
    buildDescriptionWhere(filters.search, "all", "all"),
  ];
  const contents = tableFilterValues(filters.descriptionContent).filter(
    (value) => value !== "all",
  );
  const targets = tableFilterValues(filters.descriptionTarget).filter(
    (value) => value !== "all",
  );
  if (contents.length)
    conditions.push({
      OR: contents.map((value) =>
        value === "withContent"
          ? { content: { not: "" } }
          : value === "empty"
            ? { content: "" }
            : { id: { in: [] } },
      ),
    });
  if (targets.length)
    conditions.push({
      OR: targets.map((value) =>
        ["course", "section", "teacher", "homework"].includes(value)
          ? buildDescriptionWhere("", "all", value)
          : { id: { in: [] } },
      ),
    });
  if (filters.content) conditions.push({ content: ilike(filters.content) });
  if (filters.author)
    conditions.push({ lastEditedBy: userWhere(filters.author) });
  if (filters.target) conditions.push(targetWhere(filters.target));
  if (filters.editedAt)
    conditions.push({
      OR: [
        { lastEditedAt: dateTableFilter(filters, "editedAt") },
        { lastEditedAt: null, updatedAt: dateTableFilter(filters, "editedAt") },
      ],
    });
  return { AND: conditions };
}

export function moderationHomeworkWhere(
  filters: Filters,
): Prisma.HomeworkWhereInput {
  const conditions: Prisma.HomeworkWhereInput[] = [
    buildHomeworkWhere(filters.search),
  ];
  if (filters.content) conditions.push({ title: ilike(filters.content) });
  if (filters.author) conditions.push({ createdBy: userWhere(filters.author) });
  if (filters.target)
    conditions.push({
      section: {
        OR: [
          { code: ilike(filters.target) },
          { course: { code: ilike(filters.target) } },
          { course: { nameCn: ilike(filters.target) } },
        ],
      },
    });
  if (filters.createdAt)
    conditions.push({ createdAt: dateTableFilter(filters, "createdAt") });
  if (filters.dueAt)
    conditions.push({ submissionDueAt: dateTableFilter(filters, "dueAt") });
  const statuses = tableFilterValues(filters.status).filter(
    (value) => value !== "all",
  );
  if (statuses.length)
    conditions.push({
      OR: statuses.flatMap((value): Prisma.HomeworkWhereInput[] =>
        value === "active"
          ? [{ deletedAt: null }]
          : value === "deleted"
            ? [{ deletedAt: { not: null } }]
            : [],
      ),
    });
  return { AND: conditions };
}

export function moderationSuspensionWhere(
  filters: Filters,
): Prisma.UserSuspensionWhereInput {
  const conditions: Prisma.UserSuspensionWhereInput[] = [];
  if (filters.search)
    conditions.push({
      OR: [
        { user: userWhere(filters.search) },
        { reason: ilike(filters.search) },
        { note: ilike(filters.search) },
      ],
    });
  if (filters.author) conditions.push({ user: userWhere(filters.author) });
  if (filters.reason) conditions.push({ reason: ilike(filters.reason) });
  if (filters.note) conditions.push({ note: ilike(filters.note) });
  if (filters.createdAt)
    conditions.push({ createdAt: dateTableFilter(filters, "createdAt") });
  if (filters.expiresAt)
    conditions.push({ expiresAt: dateTableFilter(filters, "expiresAt") });
  const statuses = tableFilterValues(filters.status).filter(
    (value) => value !== "all",
  );
  if (statuses.length)
    conditions.push({
      OR: statuses.flatMap((value): Prisma.UserSuspensionWhereInput[] =>
        value === "active"
          ? [{ liftedAt: null }]
          : value === "lifted"
            ? [{ liftedAt: { not: null } }]
            : [],
      ),
    });
  if (filters.permanent)
    conditions.push({
      OR: tableFilterValues(filters.permanent).flatMap(
        (value): Prisma.UserSuspensionWhereInput[] =>
          value === "true"
            ? [{ expiresAt: null }]
            : value === "false"
              ? [{ expiresAt: { not: null } }]
              : [],
      ),
    });
  return conditions.length ? { AND: conditions } : {};
}
