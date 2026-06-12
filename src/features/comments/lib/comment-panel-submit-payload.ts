import { commentTargetPayload } from "./comment-panel-data";
import type { CommentTargetOption, CommentTargetType } from "./comment-ui";

export function buildCommentSubmitPayload(input: {
  body: string;
  getIsAnonymous: () => boolean;
  getReplyAttachmentIds: () => string[];
  getReplyIsAnonymous: () => boolean;
  getReplyVisibility: () => string;
  getSelectedAttachments: () => string[];
  getTargetType: () => CommentTargetType;
  getVisibility: () => string;
  parentId?: string;
  submitFailed: string;
  target: CommentTargetOption | null;
}) {
  const isReply = Boolean(input.parentId);
  return {
    attachmentIds: isReply
      ? input.getReplyAttachmentIds()
      : input.getSelectedAttachments(),
    body: input.body,
    isAnonymous: isReply ? input.getReplyIsAnonymous() : input.getIsAnonymous(),
    parentId: input.parentId ?? null,
    submitFailed: input.submitFailed,
    targetPayload: commentTargetPayload(input.getTargetType(), input.target),
    visibility: isReply ? input.getReplyVisibility() : input.getVisibility(),
  };
}
