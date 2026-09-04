/** Focused comment thread lookup around a specific comment id. */
import { withCommentDbContext } from "./comment-db-context";
import {
  observeCommentViewerContext,
  withCommentReadMetadata,
} from "./comment-read-metadata";
import {
  commentTargetLookupSelect,
  commentThreadInclude,
  findComment,
  loadCommentReplyWindow,
} from "./comment-read-shared";
import { COMMENT_REPLY_PREVIEW_SIZE } from "./comment-reply-pagination";
import { buildCommentNodes } from "./comment-serialization";

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
    observeCommentViewerContext({ viewerUserId: input.viewerUserId }),
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
