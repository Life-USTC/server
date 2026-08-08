import { type CommentReactionType, Prisma } from "@/generated/prisma/client";
import {
  getViewerContext,
  type ViewerContext,
} from "@/lib/auth/viewer-context";
import { authPrisma } from "@/lib/db/auth-prisma";
import { prisma, withUserDbContext } from "@/lib/db/prisma";
import { logAppEvent } from "@/lib/log/app-logger";
import { getSafeDatabaseErrorCode } from "@/lib/log/app-logger-core";
import { withCommentDbContext } from "./comment-db-context";
import {
  buildCommentNodes,
  type CommentNode,
  type RawComment,
} from "./comment-serialization";
import type { ResolvedCommentTarget } from "./comment-utils";
import { directlyVisibleCommentWhere } from "./comment-visibility-policy";

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

type ReactionSummaryQueryClient = Pick<Prisma.TransactionClient, "$queryRaw">;

export async function withCommentAuthorProviders(
  comments: RawComment[],
): Promise<RawComment[]> {
  const userIds = Array.from(
    new Set(
      comments
        .map((comment) => comment.user?.id)
        .filter((userId): userId is string => Boolean(userId)),
    ),
  );
  const accounts =
    userIds.length === 0
      ? []
      : await authPrisma.account.findMany({
          where: {
            provider: "oidc",
            userId: { in: userIds },
          },
          select: {
            provider: true,
            userId: true,
          },
        });
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

  return viewerUserId ? withUserDbContext(viewerUserId, query) : query(prisma);
}

async function loadCommentAttachmentSummaries(
  commentIds: string[],
  viewerUserId: string | null,
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
): Promise<CommentReactionSummaryRow[]> {
  try {
    return await loadCommentReactionSummaries(commentIds, viewerUserId);
  } catch (error) {
    logCommentSummaryFailure("comment.reaction-summaries.failed", error);
    return [];
  }
}

async function loadCommentAttachmentSummariesOrEmpty(
  commentIds: string[],
  viewerUserId: string | null,
): Promise<CommentAttachmentSummaryRow[]> {
  try {
    return await loadCommentAttachmentSummaries(commentIds, viewerUserId);
  } catch (error) {
    logCommentSummaryFailure("comment.attachment-summaries.failed", error);
    return [];
  }
}

export async function withCommentReadMetadata(
  comments: RawComment[],
  viewerUserId: string | null,
): Promise<RawComment[]> {
  const commentIds = comments.map((comment) => comment.id);
  const [commentsWithProviders, reactionRows, attachmentRows] =
    await Promise.all([
      withCommentAuthorProviders(comments),
      loadCommentReactionSummariesOrEmpty(commentIds, viewerUserId),
      loadCommentAttachmentSummariesOrEmpty(commentIds, viewerUserId),
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

export async function loadCommentThread(input: {
  pagination?: { pageSize: number; skip: number };
  target: ResolvedCommentTarget;
  viewer?: ViewerContext;
  viewerUserId: string | null;
}) {
  if (input.target.empty) {
    const viewer =
      input.viewer ??
      (await getViewerContext({
        includeAdmin: false,
        userId: input.viewerUserId,
      }));
    return { comments: [], hiddenCount: 0, total: 0, viewer };
  }

  if (input.pagination) {
    const viewer =
      input.viewer ??
      (await getViewerContext({
        includeAdmin: false,
        userId: input.viewerUserId,
      }));
    const directlyVisible = directlyVisibleCommentWhere(viewer);
    const rootWhere = {
      AND: [
        input.target.whereTarget,
        { parentId: null },
        {
          OR: [directlyVisible, { thread: { some: directlyVisible } }],
        },
      ],
    } satisfies Prisma.CommentWhereInput;
    const pagination = input.pagination;
    const [total, rootComments, hiddenCount] = await withCommentDbContext(
      input.viewerUserId,
      (client) =>
        Promise.all([
          client.comment.count({ where: rootWhere }),
          client.comment.findMany({
            where: rootWhere,
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
            skip: pagination.skip,
            take: pagination.pageSize,
            select: { id: true },
          }),
          viewer.isAuthenticated
            ? Promise.resolve(0)
            : countAnonymousHiddenRoots(input.target.whereTarget),
        ]),
    );
    const rootIds = rootComments.map((comment) => comment.id);
    const comments =
      rootIds.length === 0
        ? []
        : await withCommentDbContext(input.viewerUserId, (client) =>
            client.comment.findMany({
              where: {
                AND: [
                  input.target.whereTarget,
                  {
                    OR: [{ id: { in: rootIds } }, { rootId: { in: rootIds } }],
                  },
                ],
              },
              include: commentThreadInclude,
              orderBy: [{ createdAt: "asc" }, { id: "asc" }],
            }),
          );

    const commentsWithMetadata = await withCommentReadMetadata(
      comments,
      viewer.userId,
    );
    const { roots } = buildCommentNodes(commentsWithMetadata, viewer);
    return { comments: roots, hiddenCount, total, viewer };
  }

  const [viewer, comments] = await Promise.all([
    input.viewer
      ? Promise.resolve(input.viewer)
      : getViewerContext({ includeAdmin: false, userId: input.viewerUserId }),
    withCommentDbContext(input.viewerUserId, (client) =>
      client.comment.findMany({
        where: input.target.whereTarget,
        include: commentThreadInclude,
        orderBy: { createdAt: "asc" },
      }),
    ),
  ]);

  const commentsWithMetadata = await withCommentReadMetadata(
    comments,
    viewer.userId,
  );
  const { roots, hiddenCount } = buildCommentNodes(
    commentsWithMetadata,
    viewer,
  );
  return { comments: roots, hiddenCount, total: roots.length, viewer };
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
  const threadComments = await withCommentDbContext(
    input.viewerUserId,
    (client) =>
      client.comment.findMany({
        where: {
          OR: [{ id: threadKey }, { rootId: threadKey }],
        },
        include: commentThreadInclude,
        orderBy: { createdAt: "asc" },
      }),
  );

  const commentsWithMetadata = await withCommentReadMetadata(
    threadComments,
    viewer.userId,
  );
  const { roots, hiddenCount } = buildCommentNodes(
    commentsWithMetadata,
    viewer,
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
