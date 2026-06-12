import { adminUserResponseMessage } from "@/features/admin/lib/admin-users-display";
import type { AdminUsersActionConfig } from "./admin-users-page-action-types";

export async function liftSelectedSuspension(config: AdminUsersActionConfig) {
  const selectedUser = config.getSelectedUser();
  if (!selectedUser?.activeSuspension?.id) return;
  const copy = config.getCopy();
  config.setLiftingSuspension(true);
  config.setMessage(null);
  try {
    const response = await fetch(
      `/api/admin/suspensions/${selectedUser.activeSuspension.id}`,
      { method: "PATCH" },
    );
    if (!response.ok) {
      config.setMessage(
        await adminUserResponseMessage(response, copy.liftFailed),
      );
      return;
    }
    config.replaceUser({ ...selectedUser, activeSuspension: null });
    config.setMessage(copy.liftSuccess);
  } finally {
    config.setLiftingSuspension(false);
  }
}
