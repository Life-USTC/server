import { adminUserResponseMessage } from "@/features/admin/lib/admin-users-display";
import type { AdminUsersActionConfig } from "./admin-users-page-action-types";

export async function saveSelectedUser(config: AdminUsersActionConfig) {
  const selectedUser = config.getSelectedUser();
  if (!selectedUser) return;
  const copy = config.getCopy();
  const editState = config.getEditState();
  config.setSaving(true);
  config.setMessage(null);
  try {
    const response = await fetch(`/api/admin/users/${selectedUser.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: editState.name.trim() || null,
        username: editState.username.trim() || null,
        isAdmin: editState.isAdmin,
      }),
    });
    if (!response.ok) {
      config.setMessage(
        await adminUserResponseMessage(response, copy.updateFailed),
      );
      return;
    }
    const body = await response.json();
    config.replaceUser(body.user);
    config.setMessage(copy.updateSuccess);
    config.closeDialog();
  } finally {
    config.setSaving(false);
  }
}
