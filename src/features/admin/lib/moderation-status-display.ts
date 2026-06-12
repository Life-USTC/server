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

export function moderationStatusBadgeClass(
  status: ModerationCommentLike["status"],
) {
  if (status === "active")
    return "border-success/40 bg-success/10 text-success";
  if (status === "deleted") return "border-error/40 bg-error/10 text-error";
  return "border-warning/40 bg-warning/10 text-warning";
}

export function moderationStatusBorderClass(
  status: ModerationCommentLike["status"],
) {
  if (status === "active") return "border-l-[#1a7f37]";
  if (status === "deleted") return "border-l-[#cf222e]";
  return "border-l-[#bf8700]";
}
