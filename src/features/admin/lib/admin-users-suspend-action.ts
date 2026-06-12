import {
  adminUserResponseMessage,
  adminUserSuspensionExpiresAt,
} from "@/features/admin/lib/admin-users-display";
import type { AdminUsersActionConfig } from "./admin-users-page-action-types";

export async function suspendSelectedUser(config: AdminUsersActionConfig) {
  const selectedUser = config.getSelectedUser();
  if (!selectedUser) return;
  const copy = config.getCopy();
  const suspendState = config.getSuspendState();
  config.setSuspending(true);
  config.setMessage(null);
  try {
    const response = await fetch("/api/admin/suspensions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: selectedUser.id,
        reason: suspendState.reason.trim() || undefined,
        expiresAt: adminUserSuspensionExpiresAt(
          suspendState.duration,
          suspendState.expiresAt,
        ),
      }),
    });
    if (!response.ok) {
      config.setMessage(
        await adminUserResponseMessage(response, copy.suspendFailed),
      );
      return;
    }
    const body = await response.json();
    config.replaceUser({ ...selectedUser, activeSuspension: body.suspension });
    config.setMessage(copy.suspendSuccess);
  } finally {
    config.setSuspending(false);
  }
}
