import { apiClient, apiErrorMessage } from "@/lib/api/client";
import type { AdminUsersActionConfig } from "./admin-users-page-action-types";

export async function liftSelectedSuspension(config: AdminUsersActionConfig) {
  const selectedUser = config.getSelectedUser();
  if (!selectedUser?.activeSuspension?.id) return;
  const copy = config.getCopy();
  config.setLiftingSuspension(true);
  config.setMessage(null);
  try {
    const result = await apiClient.PATCH(
      `/api/admin/suspensions/${selectedUser.activeSuspension.id}`,
    );
    if (!result.response.ok) {
      config.setMessage(apiErrorMessage(result.error, copy.liftFailed));
      return;
    }
    config.replaceUser({ ...selectedUser, activeSuspension: null });
    config.setMessage(copy.liftSuccess);
  } finally {
    config.setLiftingSuspension(false);
  }
}
