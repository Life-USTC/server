/** Cursor-paginated comment reply window read model. */
import { withCommentDbContext } from "./comment-db-context";
import {
  observeCommentViewerContext,
  withCommentReadMetadata,
} from "./comment-read-metadata";
import {
  commentThreadInclude,
  findComment,
  loadCommentReplyWindow,
} from "./comment-read-shared";
import {
  COMMENT_REPLY_PAGE_SIZE,
  decodeCommentReplyCursor,
} from "./comment-reply-pagination";
import { buildCommentNodes } from "./comment-serialization";
import { createCommentStageCounter } from "./comment-stage-analytics";

export async function loadCommentReplies(input: {
  commentId: string;
  cursor?: string | null;
  pageSize?: number;
  viewerUserId: string | null;
}) {
  const viewer = await observeCommentViewerContext({
    viewerUserId: input.viewerUserId,
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
