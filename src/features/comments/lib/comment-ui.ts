export {
  commentAuthorInitials,
  commentAuthorName,
  commentTargetLabel,
  formatUploadSize,
} from "@/features/comments/lib/comment-display";
export {
  appendMarkdown,
  attachmentMarkdown,
} from "@/features/comments/lib/comment-markdown";
export {
  commentReactionEntry,
  commentReactionKey,
  commentReactionLabel,
  commentReactionName,
  commentReactionOption,
  nextCommentReactions,
} from "@/features/comments/lib/comment-reactions";
export { updateCommentTree } from "@/features/comments/lib/comment-tree";
export {
  COMMENT_REACTION_OPTIONS,
  type CommentNodeWithContext,
  type CommentTargetOption,
  type CommentTargetType,
  type ReactionOption,
  withCommentContext,
} from "@/features/comments/lib/comment-ui-types";
