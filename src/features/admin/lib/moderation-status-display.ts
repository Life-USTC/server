import type {
  ModerationCommentLike,
  ModerationCopy,
} from "@/features/admin/lib/moderation-display-types";

export function moderationStatusLabel(
  status: ModerationCommentLike["status"],
  copy: ModerationCopy,
) {
  if (status === "softbanned") return copy.statusSoftbanned;
  if (status === "deleted") return copy.statusDeleted;
  return copy.statusActive;
}
