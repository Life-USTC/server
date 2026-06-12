import type { CommentNode } from "@/features/comments/server/comment-types";
import type { CommentsCopy } from "../components/comment-component-types";
import { commentPanelStatusLabel } from "./comment-panel-controller";
import {
  type CommentNodeWithContext,
  commentAuthorInitials,
  commentAuthorName,
  commentReactionEntry,
  commentReactionKey,
  commentReactionLabel,
  commentReactionName,
  formatUploadSize,
  nextCommentReactions,
  updateCommentTree,
} from "./comment-ui";

export function createCommentPanelDisplayActions(input: {
  getCommentCopy: () => CommentsCopy;
  getComments: () => CommentNodeWithContext[];
  getDateTimeFormatter: () => { format(value: Date): string };
  setComments: (value: CommentNodeWithContext[]) => void;
}) {
  return {
    applyReactionUpdate(
      commentId: string,
      type: string,
      shouldRemove: boolean,
    ) {
      input.setComments(
        updateCommentTree(input.getComments(), commentId, (comment) => ({
          ...comment,
          reactions: nextCommentReactions(
            comment.reactions,
            type,
            shouldRemove,
          ),
        })),
      );
    },
    authorInitials(comment: CommentNode) {
      return commentAuthorInitials(
        comment,
        input.getCommentCopy().anonymousLabel,
      );
    },
    authorName(comment: CommentNode) {
      return commentAuthorName(comment, input.getCommentCopy().anonymousLabel);
    },
    formatSize(value: number | undefined) {
      return formatUploadSize(value);
    },
    formatTime(value: Date | string | null | undefined) {
      return value ? input.getDateTimeFormatter().format(new Date(value)) : "";
    },
    reactionEntry(comment: CommentNode, type: string) {
      return commentReactionEntry(comment, type);
    },
    reactionKey(commentId: string, type: string) {
      return commentReactionKey(commentId, type);
    },
    reactionLabel(type: string) {
      return commentReactionLabel(type);
    },
    reactionName(type: string) {
      return commentReactionName(type, input.getCommentCopy().reaction ?? {});
    },
    statusLabel(status: string) {
      return commentPanelStatusLabel(status, input.getCommentCopy());
    },
  };
}
