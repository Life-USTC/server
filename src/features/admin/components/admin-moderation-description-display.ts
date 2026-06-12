import type {
  AdminModerationDescription,
  AdminModerationDescriptionCopy,
} from "./admin-moderation-description-types";

export function adminModerationDescriptionEditedAt(
  description: AdminModerationDescription,
) {
  return description.lastEditedAt ?? description.updatedAt;
}

export function adminModerationDescriptionLastEditor(
  description: AdminModerationDescription,
  copy: AdminModerationDescriptionCopy,
) {
  return (
    description.lastEditedBy?.name ??
    description.lastEditedBy?.username ??
    copy.notAvailable
  );
}
