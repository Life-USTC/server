import {
  expiresAtFromModerationDuration,
  moderationFormatMessage,
  moderationTargetHref,
  responseMessage,
} from "./moderation-display";
import type { ModerationCommentLike } from "./moderation-display-types";

export function moderationCommentDialogState(input: {
  comment: ModerationCommentLike;
  copy: {
    defaultBanReason: string;
  };
  formatDate: (value: string | Date) => string;
  origin: string | null;
}) {
  const href = moderationTargetHref(input.comment);
  return {
    commentStatus: input.comment.status,
    customExpiresAt: "",
    dialogMessage: "",
    moderationNote: input.comment.moderationNote ?? "",
    suspensionDuration: "7d",
    suspensionReason: moderationFormatMessage(input.copy.defaultBanReason, {
      date: input.formatDate(input.comment.createdAt),
      url: input.origin ? input.origin + href : href,
      content:
        input.comment.body.length > 50
          ? `${input.comment.body.slice(0, 50)}...`
          : input.comment.body,
    }),
  };
}

export async function saveModerationCommentRequest(input: {
  commentId: string | number;
  fallbackMessage: string;
  moderationNote: string;
  status: "active" | "softbanned" | "deleted";
}) {
  const response = await fetch(`/api/admin/comments/${input.commentId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      status: input.status,
      moderationNote: input.moderationNote.trim() || null,
    }),
  });
  if (!response.ok) {
    throw new Error(await responseMessage(response, input.fallbackMessage));
  }
}

export async function suspendModerationCommentAuthorRequest(input: {
  customExpiresAt: string;
  duration: string;
  fallbackMessage: string;
  reason: string;
  userId: string;
}) {
  const response = await fetch("/api/admin/suspensions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId: input.userId,
      reason: input.reason.trim() || undefined,
      expiresAt: expiresAtFromModerationDuration(
        input.duration,
        input.customExpiresAt,
      ),
    }),
  });
  if (!response.ok) {
    throw new Error(await responseMessage(response, input.fallbackMessage));
  }
}
