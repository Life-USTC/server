/** Shared comment read-model helpers used by thread, replies, and focused reads. */
import { Prisma } from "@/generated/prisma/client";
import type { ViewerContext } from "@/lib/auth/viewer-context";
import type { CommentDbClient } from "./comment-db-context";
import {
  COMMENT_REPLY_MAX_ANCESTRY_DEPTH,
  type CommentReplyCursor,
  encodeCommentReplyCursor,
} from "./comment-reply-pagination";
import type { CommentNode } from "./comment-serialization";
import {
  type CommentStageCounter,
  countCommentStageQuery,
} from "./comment-stage-analytics";

export const commentThreadInclude = {
  user: {
    select: {
      id: true,
      name: true,
      image: true,
      isAdmin: true,
    },
  },
} as const;

export type CommentDescendantWindowRow = {
  id: string;
  rootId: string;
  createdAt: Date;
  rowNumber: bigint | null;
};

export type CommentReplyWindowRow = CommentDescendantWindowRow & {
  parentId: string | null;
};

export const commentTargetLookupSelect = {
  sectionId: true,
  courseId: true,
  teacherId: true,
  sectionTeacherId: true,
  rootId: true,
  id: true,
  homework: {
    select: {
      id: true,
      title: true,
      section: {
        select: { jwId: true, code: true },
      },
    },
  },
  sectionTeacher: {
    select: {
      sectionId: true,
      teacherId: true,
      section: {
        select: {
          jwId: true,
          code: true,
          course: {
            select: { jwId: true, nameCn: true },
          },
        },
      },
      teacher: {
        select: { nameCn: true },
      },
    },
  },
  section: {
    select: {
      jwId: true,
      code: true,
      course: {
        select: { jwId: true, nameCn: true },
      },
    },
  },
  course: {
    select: { jwId: true, nameCn: true },
  },
  teacher: {
    select: { nameCn: true },
  },
} as const;

export type CommentTargetLookupRecord = Prisma.CommentGetPayload<{
  select: typeof commentTargetLookupSelect;
}>;

export function directlyVisibleCommentSql(
  alias: "child" | "root",
  viewer: ViewerContext,
) {
  const status = Prisma.raw(`${alias}."status"`);
  const visibility = Prisma.raw(`${alias}."visibility"`);
  const userId = Prisma.raw(`${alias}."userId"`);
  const visibleStatus = viewer.isAdmin
    ? Prisma.sql`${status} IN ('active', 'softbanned')`
    : viewer.userId
      ? Prisma.sql`(
          ${status} = 'active'
          OR (${status} = 'softbanned' AND ${userId} = ${viewer.userId})
        )`
      : Prisma.sql`${status} = 'active'`;
  if (viewer.isAuthenticated) return visibleStatus;
  return Prisma.sql`(${visibleStatus} AND ${visibility} = 'public')`;
}

export async function loadCommentReplyWindow(
  client: CommentDbClient,
  rootId: string,
  cursor: CommentReplyCursor | null,
  pageSize: number,
  viewer: ViewerContext,
  counter?: CommentStageCounter,
  focusId: string | null = null,
) {
  const cursorFilter = cursor
    ? Prisma.sql`
        AND (
          child."createdAt" > ${new Date(cursor.createdAt)}
          OR (
            child."createdAt" = ${new Date(cursor.createdAt)}
            AND child."id" > ${cursor.id}
          )
        )
      `
    : Prisma.empty;

  countCommentStageQuery(counter);
  const rows = await client.$queryRaw<CommentReplyWindowRow[]>(Prisma.sql`
    WITH RECURSIVE reply_window AS (
      SELECT
        candidates."id",
        candidates."parentId",
        candidates."rootId",
        candidates."createdAt",
        ROW_NUMBER() OVER (
          ORDER BY candidates."createdAt" ASC, candidates."id" ASC
        ) AS "rowNumber"
      FROM (
        SELECT
          child."id",
          child."parentId",
          child."rootId",
          child."createdAt"
        FROM "Comment" AS child
        WHERE child."rootId" = ${rootId}
          AND child."id" <> ${rootId}
          AND ${directlyVisibleCommentSql("child", viewer)}
          ${cursorFilter}
        ORDER BY child."createdAt" ASC, child."id" ASC
        LIMIT ${pageSize + 1}
      ) AS candidates
    )
    , selected_replies AS (
      SELECT "id", "parentId", "rootId", "createdAt", "rowNumber"
      FROM reply_window
      WHERE "rowNumber" <= ${pageSize + 1}
    )
    , selected_page AS (
      SELECT "id", "parentId", "rootId", "createdAt"
      FROM selected_replies
      WHERE "rowNumber" <= ${pageSize}
    )
    , focus_comment AS (
      SELECT
        child."id",
        child."parentId",
        child."rootId",
        child."createdAt",
        NULL::bigint AS "rowNumber"
      FROM "Comment" AS child
      WHERE child."id" = ${focusId}
        AND child."rootId" = ${rootId}
    )
    , ancestry_seed AS (
      SELECT "id", "parentId", "rootId", "createdAt"
      FROM selected_page
      UNION
      SELECT "id", "parentId", "rootId", "createdAt"
      FROM focus_comment
    )
    , ancestry AS (
      SELECT "id", "parentId", "rootId", "createdAt", 0 AS "depth"
      FROM ancestry_seed
      UNION ALL
      SELECT parent."id", parent."parentId", parent."rootId", parent."createdAt", ancestry."depth" + 1
      FROM "Comment" AS parent
      JOIN ancestry ON ancestry."parentId" = parent."id"
      WHERE ancestry."depth" < ${COMMENT_REPLY_MAX_ANCESTRY_DEPTH}
    )
    , bounded_rows AS (
      SELECT "id", "parentId", "rootId", "createdAt", "rowNumber"
      FROM selected_replies
      UNION
      SELECT ancestry."id", ancestry."parentId", ancestry."rootId", ancestry."createdAt", NULL::bigint
      FROM ancestry
      WHERE ancestry."id" NOT IN (SELECT "id" FROM selected_page)
    )
    SELECT "id", "parentId", "rootId", "createdAt", "rowNumber"
    FROM bounded_rows
    ORDER BY "rowNumber" ASC NULLS LAST, "createdAt" ASC, "id" ASC
  `);
  const replyRows = rows.filter((row) => row.rowNumber !== null);
  const selectedIds = [
    ...new Set(
      rows
        .filter(
          (row) => row.rowNumber === null || Number(row.rowNumber) <= pageSize,
        )
        .map((row) => row.id)
        .filter((id) => id !== rootId),
    ),
  ];
  const comments =
    selectedIds.length === 0
      ? []
      : await (async () => {
          countCommentStageQuery(counter);
          return client.comment.findMany({
            where: { id: { in: selectedIds } },
            include: commentThreadInclude,
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          });
        })();
  return {
    comments,
    nextCursor: continuationCursorFromReplyRows(rootId, replyRows, pageSize),
  };
}

export function continuationCursorFromReplyRows(
  rootId: string,
  rows: Array<{ createdAt: Date; id: string }>,
  pageSize: number,
) {
  if (rows.length <= pageSize) return null;
  const lastSelected = rows[pageSize - 1];
  return lastSelected
    ? encodeCommentReplyCursor({
        createdAt: lastSelected.createdAt.toISOString(),
        id: lastSelected.id,
        rootId,
      })
    : null;
}

export function findComment(
  nodes: CommentNode[],
  id: string,
): CommentNode | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    const nested = findComment(node.replies, id);
    if (nested) return nested;
  }
  return null;
}
