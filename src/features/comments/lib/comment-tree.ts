import type { CommentNodeWithContext } from "@/features/comments/lib/comment-ui-types";

export function updateCommentTree(
  comments: CommentNodeWithContext[],
  commentId: string,
  updater: (comment: CommentNodeWithContext) => CommentNodeWithContext,
): CommentNodeWithContext[] {
  let changed = false;
  const nextComments = comments.map((comment) => {
    let nextComment = comment;
    if (comment.id === commentId) {
      nextComment = updater(comment);
      changed = true;
    }
    const nextReplies = updateCommentTree(
      nextComment.replies,
      commentId,
      updater,
    );
    if (nextReplies !== nextComment.replies) {
      nextComment = { ...nextComment, replies: nextReplies };
      changed = true;
    }
    return nextComment;
  });
  return changed ? nextComments : comments;
}
