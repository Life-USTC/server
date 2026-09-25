import { apiClient, apiErrorMessage } from "@/lib/api/client";
import type { AdminUsersActionConfig } from "./admin-users-page-action-types";
import { suspensionExpiresAt } from "./suspension-expiration";

type AdminSuspensionResponse = {
  suspension: {
    expiresAt?: string | null;
    id?: string;
  };
};

export async function suspendSelectedUser(config: AdminUsersActionConfig) {
  const selectedUser = config.getSelectedUser();
  if (!selectedUser) return false;
  const copy = config.getCopy();
  const suspendState = config.getSuspendState();
  config.setSuspending(true);
  config.setMessage(null);
  try {
    const result = await apiClient.POST<AdminSuspensionResponse>(
      "/api/admin/suspensions",
      {
        body: {
          userId: selectedUser.id,
          reason: suspendState.reason.trim() || undefined,
          expiresAt: suspensionExpiresAt(
            suspendState.duration,
            suspendState.expiresAt,
          ),
        },
      },
    );
    if (!result.response.ok || !result.data) {
      config.setMessageVariant("destructive");
      config.setMessage(apiErrorMessage(result.error, copy.suspendFailed));
      return false;
    }
    config.replaceUser({
      ...selectedUser,
      activeSuspension: result.data.suspension,
    });
    config.setMessageVariant("default");
    config.setMessage(copy.suspendSuccess);
    config.onSuccess?.("suspend");
    return true;
  } catch {
    config.setMessageVariant("destructive");
    config.setMessage(copy.suspendFailed);
    return false;
  } finally {
    config.setSuspending(false);
  }
}
