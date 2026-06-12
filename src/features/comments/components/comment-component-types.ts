import type {
  CommentNodeWithContext,
  CommentTargetOption,
  ReactionOption,
} from "@/features/comments/lib/comment-ui";
import type { CommentNode } from "@/features/comments/server/comment-types";

export type CommentUploadOption = {
  id: string;
  filename: string;
  size?: number;
};

export type CommentsCopy = {
  anonymousLabel: string;
  anonymousBadge: string;
  cancelAction: string;
  commentTargetCurrent: string;
  commentTargetPlaceholder: string;
  copyLinkAction: string;
  deletedMessage: string;
  deletedBadge: string;
  deleteAction: string;
  deleteConfirmDescription: string;
  deleteConfirmTitle: string;
  editAction: string;
  editedLabel: string;
  editorPlaceholder: string;
  emptyTitle: string;
  hiddenNotice: string;
  linkHost: string;
  linkSection: string;
  linkTeacher: string;
  loginToComment: string;
  loginToView: string;
  loadFailed: string;
  markdownGuide: string;
  markdownModeLabel: string;
  moreActions: string;
  openAttachment: string;
  postAction: string;
  postedIn: string;
  posting: string;
  postReply: string;
  previewEmpty: string;
  reaction?: Record<string, string>;
  reactionMenu: string;
  removeAttachment: string;
  replyAction: string;
  replyPlaceholder: string;
  reportAction: string;
  saveAction: string;
  softbannedBadge: string;
  subtitle: string;
  submitFailed: string;
  suspendedExpires: string;
  suspendedMessage: string;
  suspendedPermanent: string;
  suspendedReason: string;
  suspendedTitle: string;
  tabPreview: string;
  tabWrite: string;
  ustcVerified: string;
  visibilityAnonymous: string;
  visibilityLoggedIn: string;
  visibilityPublic: string;
};

export type UploadsCopy = Record<string, string>;

export type CommentSelectOption = {
  label: string;
  value: string;
};

export type CommentReactionEntry = {
  count: number;
  viewerHasReacted: boolean;
};

export type CommentThreadProps = {
  authorInitials: (comment: CommentNode) => string;
  authorName: (comment: CommentNode) => string;
  cancelEdit: () => void;
  cancelReply: () => void;
  commentCopy: CommentsCopy;
  commentTarget: (
    comment: CommentNodeWithContext,
  ) => CommentTargetOption | null;
  copyCommentLink: (comment: CommentNode) => void;
  editAttachmentOptions: (comment: CommentNode) => CommentUploadOption[];
  formatSize: (value: number | undefined) => string;
  formatTime: (value: Date | string | null | undefined) => string;
  openDeleteDialog: (comment: CommentNode) => void;
  react: (comment: CommentNode, type: string) => void;
  reactionEntry: (
    comment: CommentNode,
    type: string,
  ) => CommentReactionEntry | undefined;
  reactionKey: (commentId: string, type: string) => string;
  reactionLabel: (type: string) => string;
  reactionName: (type: string) => string;
  reactionOptions: ReactionOption[];
  removeReplyAttachment: (uploadId: string) => void;
  saveEdit: (comment: CommentNode) => void;
  startEdit: (comment: CommentNode) => void;
  statusLabel: (status: string) => string;
  submitComment: (
    parentId?: string | null,
    replyBody?: string,
    target?: CommentTargetOption | null,
  ) => void;
  toggleReply: (comment: CommentNode) => void;
  uploadCopy: UploadsCopy;
  uploadFile: (file: File, mode?: "edit" | "new" | "reply") => void;
  visibilityOptions: CommentSelectOption[];
};
