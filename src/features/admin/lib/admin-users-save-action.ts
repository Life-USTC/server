import { apiClient, apiErrorMessage } from "@/lib/api/client";
import type { AdminUserRow } from "../components/admin-user-types";
import type { AdminUsersActionConfig } from "./admin-users-page-action-types";

type AdminUserUpdateResponse = {
  user: AdminUserRow;
};

export async function saveSelectedUser(config: AdminUsersActionConfig) {
  const selectedUser = config.getSelectedUser();
  if (!selectedUser) return;
  const copy = config.getCopy();
  const editState = config.getEditState();
  config.setSaving(true);
  config.setMessage(null);
  try {
    const result = await apiClient.PATCH<AdminUserUpdateResponse>(
      `/api/admin/users/${selectedUser.id}`,
      {
        body: {
          name: editState.name.trim() || null,
          username: editState.username.trim() || null,
          isAdmin: editState.isAdmin,
        },
      },
    );
    if (!result.response.ok || !result.data) {
      config.setMessage(apiErrorMessage(result.error, copy.updateFailed));
      return;
    }
    config.replaceUser(result.data.user);
    config.setMessage(copy.updateSuccess);
    config.closeDialog();
  } finally {
    config.setSaving(false);
  }
}
