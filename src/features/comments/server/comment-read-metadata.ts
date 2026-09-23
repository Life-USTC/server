/** Comment author providers and reaction/attachment read metadata. */
import { type CommentReactionType, Prisma } from "@/generated/prisma/client";
import {
  getViewerContext,
  type ViewerContext,
  type ViewerContextInstrumentation,
} from "@/lib/auth/viewer-context";
import { authPrisma } from "@/lib/db/auth-prisma";
import { prisma, withUserDbContext } from "@/lib/db/prisma";
import { getUserRlsTransactionClient } from "@/lib/db/rls-context";
import { logAppEvent } from "@/lib/log/app-logger";
import { getSafeDatabaseErrorCode } from "@/lib/log/app-logger-core";
import type { RawComment } from "./comment-serialization";
import {
  type CommentStageCounter,
  countCommentStageQuery,
  countCommentStageTransaction,
  createCommentStageCounter,
  observeCommentStage,
} from "./comment-stage-analytics";

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

export function observeCommentViewerContext(input: {
  counter?: CommentStageCounter;
  viewer?: ViewerContext;
  viewerUserId: string | null;
}) {
  const counter =
    input.counter ??
    createCommentStageCounter({
      dbContext: "none",
      dbLabel: "app",
    });
  const instrumentation: ViewerContextInstrumentation = {
    onQuery: () => countCommentStageQuery(counter),
  };

  return observeCommentStage({
    counter,
    stage: "viewer.context",
    work: () =>
      input.viewer
        ? Promise.resolve(input.viewer)
        : getViewerContext({
            includeAdmin: false,
            userId: input.viewerUserId,
            instrumentation,
          }),
  });
}

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
