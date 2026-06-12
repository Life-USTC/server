import { COMMENT_REACTION_OPTIONS } from "@/features/comments/lib/comment-ui-types";
import type {
  CommentNode,
  CommentReaction,
} from "@/features/comments/server/comment-types";

export function commentReactionOption(type: string) {
  return COMMENT_REACTION_OPTIONS.find((option) => option.type === type);
}

export function commentReactionLabel(type: string) {
  return commentReactionOption(type)?.emoji ?? "🙂";
}

export function commentReactionName(
  type: string,
  reactionCopy: Record<string, string>,
) {
  return reactionCopy[type] ?? type;
}

export function commentReactionEntry(comment: CommentNode, type: string) {
  return comment.reactions.find((reaction) => reaction.type === type);
}

export function commentReactionKey(commentId: string, type: string) {
  return `${commentId}:${type}`;
}

export function nextCommentReactions(
  reactions: CommentReaction[],
  type: string,
  shouldRemove: boolean,
) {
  const existing = reactions.find((reaction) => reaction.type === type);
  if (!existing) {
    return shouldRemove
      ? reactions
      : [...reactions, { count: 1, type, viewerHasReacted: true }];
  }

  const nextCount = Math.max(0, existing.count + (shouldRemove ? -1 : 1));
  return reactions
    .map((reaction) =>
      reaction.type === type
        ? { ...reaction, count: nextCount, viewerHasReacted: !shouldRemove }
        : reaction,
    )
    .filter((reaction) => reaction.count > 0 || reaction.viewerHasReacted);
}
