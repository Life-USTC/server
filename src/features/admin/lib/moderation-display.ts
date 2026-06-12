export {
  expiresAtFromModerationDuration,
  formAlertVariant,
  responseMessage,
} from "@/features/admin/lib/moderation-action-display";
export type {
  ModerationCommentLike,
  ModerationCopy,
  ModerationDescriptionLike,
  ModerationTab,
} from "@/features/admin/lib/moderation-display-types";
export { moderationHref } from "@/features/admin/lib/moderation-routing-display";
export {
  moderationStatusBadgeClass,
  moderationStatusBorderClass,
  moderationStatusLabel,
} from "@/features/admin/lib/moderation-status-display";
export {
  moderationCommentAuthorLabel,
  moderationDescriptionEditedAt,
  moderationDescriptionTargetHref,
  moderationTargetHref,
  moderationTargetLabel,
  visibleModerationComments,
} from "@/features/admin/lib/moderation-target-display";

export function moderationFormatMessage(
  template: string,
  values: Record<string, string>,
) {
  return Object.entries(values).reduce(
    (message, [key, value]) => message.replace(`{${key}}`, value),
    template,
  );
}
