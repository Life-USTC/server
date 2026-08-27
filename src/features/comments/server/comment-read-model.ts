import { type CommentReactionType, Prisma } from "@/generated/prisma/client";
import { runCloudflareTraceSpan } from "@/lib/adapters/cloudflare-runtime";
import {
  getViewerContext,
  type ViewerContext,
} from "@/lib/auth/viewer-context";
import { authPrisma } from "@/lib/db/auth-prisma";
import { prisma, withUserDbContext } from "@/lib/db/prisma";
import { getUserRlsTransactionClient } from "@/lib/db/rls-context";
import { logAppEvent } from "@/lib/log/app-logger";
import { getSafeDatabaseErrorCode } from "@/lib/log/app-logger-core";
import {
  type CommentDbClient,
  withCommentDbContext,
} from "./comment-db-context";
import {
  COMMENT_REPLY_MAX_ANCESTRY_DEPTH,
  COMMENT_REPLY_PAGE_SIZE,
  COMMENT_REPLY_PREVIEW_SIZE,
  type CommentReplyCursor,
  decodeCommentReplyCursor,
  encodeCommentReplyCursor,
} from "./comment-reply-pagination";
import {
  buildCommentNodes,
  type CommentNode,
  type RawComment,
} from "./comment-serialization";
import {
  type CommentStageCounter,
  countCommentStageQuery,
  countCommentStageTransaction,
  createCommentStageCounter,
  observeCommentStage,
} from "./comment-stage-analytics";
import type { ResolvedCommentTarget } from "./comment-utils";

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

type CommentReactionSummaryRow = {
  commentId: string;
  type: CommentReactionType;
  count: bigint;
  viewerHasReacted: boolean;
};

type CommentAttachmentSummaryRow = {
  commentId: string;
  contentType: string | null;
  filename: string;
  id: string;
  size: number;
  uploadId: string;
};

type CommentRootPageRow = {
  id: string | null;
  total: bigint;
};

type ReactionSummaryQueryClient = Pick<Prisma.TransactionClient, "$queryRaw">;

type CommentDescendantWindowRow = {
  id: string;
  rootId: string;
  createdAt: Date;
  rowNumber: bigint | null;
};

export async function withCommentAuthorProviders(
  comments: RawComment[],
  counter?: CommentStageCounter,
): Promise<RawComment[]> {
  const userIds = Array.from(
    new Set(
      comments
        .map((comment) => comment.user?.id)
        .filter((userId): userId is string => Boolean(userId)),
    ),
  );
  const accounts = await (async () => {
    if (userIds.length === 0) return [];
    countCommentStageQuery(counter);
    return authPrisma.account.findMany({
      where: {
        provider: "oidc",
        userId: { in: userIds },
      },
      select: {
        provider: true,
        userId: true,
      },
    });
  })();
  const accountsByUserId = new Map<string, { provider: string }[]>();

  for (const account of accounts) {
    const providers = accountsByUserId.get(account.userId) ?? [];
    providers.push({ provider: account.provider });
    accountsByUserId.set(account.userId, providers);
  }

  return comments.map((comment) => ({
    ...comment,
    user: comment.user
      ? {
          ...comment.user,
          accounts: accountsByUserId.get(comment.user.id) ?? [],
        }
      : null,
  }));
}

async function loadCommentReactionSummaries(
  commentIds: string[],
  viewerUserId: string | null,
  counter?: CommentStageCounter,
) {
  if (commentIds.length === 0) return [];

  const query = (client: ReactionSummaryQueryClient) =>
    client.$queryRaw<CommentReactionSummaryRow[]>(Prisma.sql`
      SELECT
        "commentId",
        "type",
        "count",
        "viewerHasReacted"
      FROM public.comment_reaction_summaries(
        ARRAY[${Prisma.join(commentIds)}]::text[]
      )
    `);

  countCommentStageQuery(counter);
  if (viewerUserId && !getUserRlsTransactionClient()) {
    countCommentStageTransaction(counter);
  }
  return viewerUserId ? withUserDbContext(viewerUserId, query) : query(prisma);
}

async function loadCommentAttachmentSummaries(
  commentIds: string[],
  viewerUserId: string | null,
  counter?: CommentStageCounter,
) {
  if (commentIds.length === 0) return [];

  const query = (client: ReactionSummaryQueryClient) =>
    client.$queryRaw<CommentAttachmentSummaryRow[]>(Prisma.sql`
      SELECT
        "id",
        "commentId",
        "uploadId",
        "filename",
        "contentType",
        "size"
      FROM public.comment_attachment_summaries(
        ARRAY[${Prisma.join(commentIds)}]::text[]
      )
    `);

  countCommentStageQuery(counter);
  if (viewerUserId && !getUserRlsTransactionClient()) {
    countCommentStageTransaction(counter);
  }
  return viewerUserId ? withUserDbContext(viewerUserId, query) : query(prisma);
}

function logCommentSummaryFailure(
  event:
    | "comment.reaction-summaries.failed"
    | "comment.attachment-summaries.failed",
  error: unknown,
) {
  const code = getSafeDatabaseErrorCode(error);
  // Summary RPCs are optional for the thread list; grant/query failures must
  // not 500 the whole comments endpoint (historically the dominant 500 source).
  logAppEvent(
    "warn",
    event,
    {
      event,
      source: "comments",
      ...(code ? { code } : {}),
    },
    error,
  );
}

async function loadCommentReactionSummariesOrEmpty(
  commentIds: string[],
  viewerUserId: string | null,
  counter?: CommentStageCounter,
): Promise<CommentReactionSummaryRow[]> {
  try {
    return await loadCommentReactionSummaries(
      commentIds,
      viewerUserId,
      counter,
    );
  } catch (error) {
    logCommentSummaryFailure("comment.reaction-summaries.failed", error);
    return [];
  }
}

async function loadCommentAttachmentSummariesOrEmpty(
  commentIds: string[],
  viewerUserId: string | null,
  counter?: CommentStageCounter,
): Promise<CommentAttachmentSummaryRow[]> {
  try {
    return await loadCommentAttachmentSummaries(
      commentIds,
      viewerUserId,
      counter,
    );
  } catch (error) {
    logCommentSummaryFailure("comment.attachment-summaries.failed", error);
    return [];
  }
}

export async function withCommentReadMetadata(
  comments: RawComment[],
  viewerUserId: string | null,
  counter?: CommentStageCounter,
): Promise<RawComment[]> {
  const commentIds = comments.map((comment) => comment.id);
  // Keep the optional RPCs in independent RLS transactions. A PostgreSQL
  // statement error aborts its transaction, so sharing one context would let
  // a reaction/attachment grant failure take down the whole read model.
  const [commentsWithProviders, reactionRows, attachmentRows] =
    await Promise.all([
      withCommentAuthorProviders(comments, counter),
      loadCommentReactionSummariesOrEmpty(commentIds, viewerUserId, counter),
      loadCommentAttachmentSummariesOrEmpty(commentIds, viewerUserId, counter),
    ]);
  const reactionsByCommentId = new Map<
    string,
    RawComment["reactionSummaries"]
  >();

  for (const row of reactionRows) {
    const summaries = reactionsByCommentId.get(row.commentId) ?? [];
    summaries.push({
      type: row.type,
      count: Number(row.count),
      viewerHasReacted: row.viewerHasReacted,
    });
    reactionsByCommentId.set(row.commentId, summaries);
  }

  const attachmentsByCommentId = new Map<
    string,
    NonNullable<RawComment["attachments"]>
  >();
  for (const row of attachmentRows) {
    const attachments = attachmentsByCommentId.get(row.commentId) ?? [];
    attachments.push({
      id: row.id,
      uploadId: row.uploadId,
      upload: {
        contentType: row.contentType,
        filename: row.filename,
        size: row.size,
      },
    });
    attachmentsByCommentId.set(row.commentId, attachments);
  }

  return commentsWithProviders.map((comment) => ({
    ...comment,
    attachments: attachmentsByCommentId.get(comment.id) ?? [],
    reactionSummaries: reactionsByCommentId.get(comment.id) ?? [],
  }));
}

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

async function countAnonymousHiddenRoots(
  whereTarget: Record<string, number | string>,
  counter?: CommentStageCounter,
): Promise<number> {
  const sectionId =
    typeof whereTarget.sectionId === "number" ? whereTarget.sectionId : null;
  const courseId =
    typeof whereTarget.courseId === "number" ? whereTarget.courseId : null;
  const teacherId =
    typeof whereTarget.teacherId === "number" ? whereTarget.teacherId : null;
  const homeworkId =
    typeof whereTarget.homeworkId === "string" ? whereTarget.homeworkId : null;
  const sectionTeacherId =
    typeof whereTarget.sectionTeacherId === "number"
      ? whereTarget.sectionTeacherId
      : null;

  countCommentStageQuery(counter);
  const [row] = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT public.comment_hidden_root_count(
      ${sectionId},
      ${courseId},
      ${teacherId},
      ${homeworkId},
      ${sectionTeacherId}
    ) AS count
  `;
  return Number(row?.count ?? 0);
}

function commentTargetPredicate(
  alias: "child" | "parent" | "root",
  whereTarget: Record<string, number | string>,
) {
  const column = (name: string) => Prisma.raw(`${alias}."${name}"`);
  if (typeof whereTarget.sectionId === "number") {
    return Prisma.sql`${column("sectionId")} = ${whereTarget.sectionId}`;
  }
  if (typeof whereTarget.courseId === "number") {
    return Prisma.sql`${column("courseId")} = ${whereTarget.courseId}`;
  }
  if (typeof whereTarget.teacherId === "number") {
    return Prisma.sql`${column("teacherId")} = ${whereTarget.teacherId}`;
  }
  if (typeof whereTarget.homeworkId === "string") {
    return Prisma.sql`${column("homeworkId")} = ${whereTarget.homeworkId}`;
  }
  if (typeof whereTarget.sectionTeacherId === "number") {
    return Prisma.sql`${column("sectionTeacherId")} = ${whereTarget.sectionTeacherId}`;
  }
  return Prisma.sql`FALSE`;
}

function directlyVisibleCommentSql(
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

async function loadPaginatedCommentRoots(
  client: Pick<Prisma.TransactionClient, "$queryRaw">,
  target: ResolvedCommentTarget,
  viewer: ViewerContext,
  pagination: { pageSize: number; skip: number },
  counter?: CommentStageCounter,
) {
  const rootVisible = directlyVisibleCommentSql("root", viewer);
  const childVisible = directlyVisibleCommentSql("child", viewer);
  const query = Prisma.sql`
    WITH eligible_roots AS MATERIALIZED (
      -- A root hidden from this viewer cannot expose its own timestamp. Use
      -- the earliest directly visible descendant as its viewer-safe ordering
      -- key so SQL paging and the redacted root placeholder sort identically.
      SELECT
        root.id,
        CASE
          WHEN ${rootVisible} THEN root."createdAt"
          ELSE visible_child."createdAt"
        END AS "orderCreatedAt"
      FROM "Comment" AS root
      LEFT JOIN LATERAL (
        SELECT child.id, child."createdAt"
        FROM "Comment" AS child
        WHERE ${commentTargetPredicate("child", target.whereTarget)}
          AND ${childVisible}
          AND NOT COALESCE((${rootVisible}), FALSE)
          AND child."rootId" = root.id
        ORDER BY child."createdAt" ASC, child.id ASC
        LIMIT 1
      ) AS visible_child ON TRUE
      WHERE ${commentTargetPredicate("root", target.whereTarget)}
        AND root."parentId" IS NULL
        AND (
          ${rootVisible}
          OR visible_child.id IS NOT NULL
        )
    ),
    paged_roots AS (
      SELECT id, "orderCreatedAt"
      FROM eligible_roots
      ORDER BY "orderCreatedAt" ASC, id ASC
      OFFSET ${pagination.skip}
      LIMIT ${pagination.pageSize}
    ),
    root_total AS (
      SELECT count(*)::bigint AS total
      FROM eligible_roots
    )
    SELECT page.id, total.total
    FROM root_total AS total
    LEFT JOIN paged_roots AS page ON TRUE
  `;
  countCommentStageQuery(counter);
  const rows = await client.$queryRaw<CommentRootPageRow[]>(query);
  return {
    rootIds: rows.flatMap((row) => (row.id ? [row.id] : [])),
    total: Number(rows[0]?.total ?? 0),
  };
}

async function loadBoundedCommentDescendants(
  client: CommentDbClient,
  target: ResolvedCommentTarget,
  rootIds: string[],
  viewer: ViewerContext,
  counter?: CommentStageCounter,
) {
  if (rootIds.length === 0) {
    return {
      comments: [] as RawComment[],
      repliesNextCursorByRootId: new Map<string, string | null>(),
    };
  }

  const query = Prisma.sql`
    WITH RECURSIVE ranked_descendants AS (
      SELECT
        candidates."id",
        candidates."parentId",
        candidates."rootId",
        candidates."createdAt",
        ROW_NUMBER() OVER (
          PARTITION BY candidates."rootId"
          ORDER BY candidates."createdAt" ASC, candidates."id" ASC
        ) AS "rowNumber"
      FROM (VALUES ${Prisma.join(rootIds.map((rootId) => Prisma.sql`(${rootId})`))})
        AS requested("rootId")
      CROSS JOIN LATERAL (
        SELECT
          child."id",
          child."parentId",
          child."rootId",
          child."createdAt"
        FROM "Comment" AS child
        WHERE ${commentTargetPredicate("child", target.whereTarget)}
          AND ${directlyVisibleCommentSql("child", viewer)}
          AND child."rootId" = requested."rootId"
        ORDER BY child."createdAt" ASC, child."id" ASC
        LIMIT ${COMMENT_REPLY_PREVIEW_SIZE + 1}
      ) AS candidates
    )
    , preview_descendants AS (
      SELECT "id", "parentId", "rootId", "createdAt", "rowNumber"
      FROM ranked_descendants
      WHERE "rowNumber" <= ${COMMENT_REPLY_PREVIEW_SIZE}
    )
    , ancestry AS (
      SELECT "id", "parentId", "rootId", "createdAt", 0 AS "depth"
      FROM preview_descendants
      UNION ALL
      SELECT parent."id", parent."parentId", parent."rootId", parent."createdAt", ancestry."depth" + 1
      FROM "Comment" AS parent
      JOIN ancestry ON ancestry."parentId" = parent."id"
      WHERE ancestry."depth" < ${COMMENT_REPLY_MAX_ANCESTRY_DEPTH}
        AND ${commentTargetPredicate("parent", target.whereTarget)}
    )
    , bounded_rows AS (
      SELECT "id", "rootId", "createdAt", "rowNumber"
      FROM ranked_descendants
      WHERE "rowNumber" <= ${COMMENT_REPLY_PREVIEW_SIZE + 1}
      UNION
      SELECT ancestry."id", ancestry."rootId", ancestry."createdAt", NULL::bigint
      FROM ancestry
      WHERE ancestry."id" NOT IN (SELECT "id" FROM preview_descendants)
    )
    SELECT "id", "rootId", "createdAt", "rowNumber"
    FROM bounded_rows
    ORDER BY "rootId" ASC NULLS LAST, "rowNumber" ASC NULLS LAST, "createdAt" ASC, "id" ASC
  `;
  countCommentStageQuery(counter);
  const rows = await client.$queryRaw<CommentDescendantWindowRow[]>(query);
  const selectedRows = rows.filter(
    (row) =>
      row.rowNumber !== null &&
      Number(row.rowNumber) <= COMMENT_REPLY_PREVIEW_SIZE,
  );
  const selectedIds = [
    ...new Set([
      ...rootIds,
      ...selectedRows.map((row) => row.id),
      ...rows.filter((row) => row.rowNumber === null).map((row) => row.id),
    ]),
  ];
  if (selectedIds.length === 0) {
    return {
      comments: [] as RawComment[],
      repliesNextCursorByRootId: new Map<string, string | null>(),
    };
  }

  countCommentStageQuery(counter);
  const comments = await client.comment.findMany({
    where: { AND: [target.whereTarget, { id: { in: selectedIds } }] },
    include: commentThreadInclude,
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });

  const repliesNextCursorByRootId = new Map<string, string | null>();
  for (const rootId of rootIds) {
    const rootRows = rows.filter(
      (row) => row.rootId === rootId && row.rowNumber !== null,
    );
    if (rootRows.length <= COMMENT_REPLY_PREVIEW_SIZE) {
      repliesNextCursorByRootId.set(rootId, null);
      continue;
    }
    const lastSelected = rootRows[COMMENT_REPLY_PREVIEW_SIZE - 1];
    repliesNextCursorByRootId.set(
      rootId,
      lastSelected
        ? encodeCommentReplyCursor({
            createdAt: lastSelected.createdAt.toISOString(),
            id: lastSelected.id,
            rootId,
          })
        : null,
    );
  }

  return { comments, repliesNextCursorByRootId };
}

type CommentReplyWindowRow = CommentDescendantWindowRow & {
  parentId: string | null;
};

async function loadCommentReplyWindow(
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

function continuationCursorFromReplyRows(
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

export async function loadCommentThread(input: {
  pagination?: { pageSize: number; skip: number };
  target: ResolvedCommentTarget;
  viewer?: ViewerContext;
  viewerUserId: string | null;
}) {
  if (input.target.empty) {
    const viewer = await observeCommentStage({
      counter: input.viewer
        ? createCommentStageCounter({ dbContext: "none", dbLabel: "app" })
        : undefined,
      stage: "viewer.context",
      work: () =>
        input.viewer
          ? Promise.resolve(input.viewer)
          : getViewerContext({
              includeAdmin: false,
              userId: input.viewerUserId,
            }),
    });
    return { comments: [], hiddenCount: 0, total: 0, viewer };
  }

  const viewer = await runCloudflareTraceSpan(
    "viewer.context",
    { source: "comments" },
    () =>
      observeCommentStage({
        counter: input.viewer
          ? createCommentStageCounter({ dbContext: "none", dbLabel: "app" })
          : undefined,
        stage: "viewer.context",
        work: () =>
          input.viewer
            ? Promise.resolve(input.viewer)
            : getViewerContext({
                includeAdmin: false,
                userId: input.viewerUserId,
              }),
      }),
  );
  const pagination = input.pagination ?? { pageSize: 20, skip: 0 };
  const rootCounter = createCommentStageCounter({
    dbContext: input.viewerUserId ? "rls" : "none",
    dbLabel: "app",
  });
  if (input.viewerUserId && !getUserRlsTransactionClient()) {
    countCommentStageTransaction(rootCounter);
  }
  const { comments, hiddenCount, repliesNextCursorByRootId, total } =
    await withCommentDbContext(input.viewerUserId, async (client) => {
      const rootPagePromise = runCloudflareTraceSpan(
        "comments.root",
        {
          pageSize: pagination.pageSize,
          skip: pagination.skip,
          targetType: Object.keys(input.target.whereTarget)[0],
        },
        () =>
          observeCommentStage({
            counter: rootCounter,
            details: (result) => ({
              rootCount: result?.rootIds.length,
            }),
            stage: "comments.root",
            work: () =>
              loadPaginatedCommentRoots(
                client,
                input.target,
                viewer,
                pagination,
                rootCounter,
              ),
          }),
      );
      const [rootPage, hiddenCount] = await Promise.all([
        rootPagePromise,
        viewer.isAuthenticated
          ? Promise.resolve(0)
          : countAnonymousHiddenRoots(input.target.whereTarget, rootCounter),
      ]);
      const descendantsCounter = createCommentStageCounter({
        dbContext: input.viewerUserId ? "rls" : "none",
        dbLabel: "app",
      });
      const descendantResult =
        rootPage.rootIds.length === 0
          ? {
              comments: [] as RawComment[],
              repliesNextCursorByRootId: new Map<string, string | null>(),
            }
          : await runCloudflareTraceSpan(
              "comments.descendants",
              {
                rootCount: rootPage.rootIds.length,
                targetType: Object.keys(input.target.whereTarget)[0],
              },
              () =>
                observeCommentStage({
                  counter: descendantsCounter,
                  details: (result) => ({
                    loadedCount: result?.comments.length,
                  }),
                  stage: "comments.descendants",
                  work: () =>
                    loadBoundedCommentDescendants(
                      client,
                      input.target,
                      rootPage.rootIds,
                      viewer,
                      descendantsCounter,
                    ),
                }),
            );

      return {
        comments: descendantResult.comments,
        hiddenCount,
        repliesNextCursorByRootId: descendantResult.repliesNextCursorByRootId,
        total: rootPage.total,
      };
    });

  const summariesCounter = createCommentStageCounter({
    dbContext: viewer.userId ? "rls" : "none",
    dbLabel: "app",
  });
  const commentsWithMetadata = await runCloudflareTraceSpan(
    "comments.summaries",
    { commentCount: comments.length },
    () =>
      observeCommentStage({
        counter: summariesCounter,
        details: () => ({ loadedCount: comments.length }),
        stage: "comments.summaries",
        work: () =>
          withCommentReadMetadata(comments, viewer.userId, summariesCounter),
      }),
  );
  const { roots } = buildCommentNodes(commentsWithMetadata, viewer, {
    repliesNextCursorByRootId,
  });
  return { comments: roots, hiddenCount, total, viewer };
}

export async function loadCommentReplies(input: {
  commentId: string;
  cursor?: string | null;
  pageSize?: number;
  viewerUserId: string | null;
}) {
  const viewer = await getViewerContext({
    includeAdmin: false,
    userId: input.viewerUserId,
  });
  const pageSize = Math.min(
    Math.max(input.pageSize ?? COMMENT_REPLY_PAGE_SIZE, 1),
    COMMENT_REPLY_PAGE_SIZE,
  );
  const decodedCursor = input.cursor
    ? decodeCommentReplyCursor(input.cursor)
    : null;

  const loaded = await withCommentDbContext(
    input.viewerUserId,
    async (client) => {
      const anchor = await client.comment.findUnique({
        where: { id: input.commentId },
        select: { id: true, rootId: true },
      });
      if (!anchor) return null;

      const rootId = anchor.rootId ?? anchor.id;
      if (input.cursor && (!decodedCursor || decodedCursor.rootId !== rootId)) {
        return { invalidCursor: true as const };
      }
      const root = await client.comment.findUnique({
        where: { id: rootId },
        include: commentThreadInclude,
      });
      if (!root) return null;
      const counter = createCommentStageCounter({
        dbContext: input.viewerUserId ? "rls" : "none",
        dbLabel: "app",
      });
      const replyWindow = await loadCommentReplyWindow(
        client,
        rootId,
        decodedCursor,
        pageSize,
        viewer,
        counter,
      );
      return {
        comments: [root, ...replyWindow.comments],
        nextCursor: replyWindow.nextCursor,
        rootId,
      };
    },
  );

  if (!loaded) {
    return { ok: false as const, error: "not_found" as const };
  }
  if ("invalidCursor" in loaded) {
    return { ok: false as const, error: "invalid_cursor" as const };
  }

  const commentsWithMetadata = await withCommentReadMetadata(
    loaded.comments,
    viewer.userId,
  );
  const { roots } = buildCommentNodes(commentsWithMetadata, viewer, {
    repliesNextCursorByRootId: new Map([[loaded.rootId, loaded.nextCursor]]),
  });
  if (!findComment(roots, loaded.rootId)) {
    return { ok: false as const, error: "forbidden" as const };
  }

  return {
    ok: true as const,
    nextCursor: loaded.nextCursor,
    rootId: loaded.rootId,
    thread: roots,
    viewer,
  };
}

export async function loadFocusedCommentThread(input: {
  commentId: string;
  viewerUserId: string | null;
}) {
  const [comment, viewer] = await Promise.all([
    withCommentDbContext(input.viewerUserId, (client) =>
      client.comment.findUnique({
        where: { id: input.commentId },
        select: commentTargetLookupSelect,
      }),
    ),
    getViewerContext({
      includeAdmin: false,
      userId: input.viewerUserId,
    }),
  ]);

  if (!comment) {
    return { ok: false as const, error: "not_found" as const };
  }

  const threadKey = comment.rootId ?? comment.id;
  const threadWindow = await withCommentDbContext(
    input.viewerUserId,
    async (client) => {
      const root = await client.comment.findUnique({
        where: { id: threadKey },
        include: commentThreadInclude,
      });
      if (!root) return { comments: [], nextCursor: null };

      const replyWindow = await loadCommentReplyWindow(
        client,
        threadKey,
        null,
        COMMENT_REPLY_PREVIEW_SIZE,
        viewer,
        undefined,
        input.commentId,
      );
      const comments = [root, ...replyWindow.comments];
      return { comments, nextCursor: replyWindow.nextCursor };
    },
  );

  const commentsWithMetadata = await withCommentReadMetadata(
    threadWindow.comments,
    viewer.userId,
  );
  const { roots, hiddenCount } = buildCommentNodes(
    commentsWithMetadata,
    viewer,
    {
      repliesNextCursorByRootId: new Map([
        [threadKey, threadWindow.nextCursor],
      ]),
    },
  );
  const focus = findComment(roots, input.commentId);

  if (!focus) {
    return { ok: false as const, error: "forbidden" as const };
  }

  return {
    ok: true as const,
    focusId: input.commentId,
    hiddenCount,
    target: comment,
    thread: roots,
    viewer,
  };
}

function findComment(nodes: CommentNode[], id: string): CommentNode | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    const nested = findComment(node.replies, id);
    if (nested) return nested;
  }
  return null;
}
