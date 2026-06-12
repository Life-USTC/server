import { liftSelectedSuspension } from "./admin-users-lift-suspension-action";
import type { AdminUsersActionConfig } from "./admin-users-page-action-types";
import { saveSelectedUser } from "./admin-users-save-action";
import { suspendSelectedUser } from "./admin-users-suspend-action";

export function createAdminUsersPageActions(config: AdminUsersActionConfig) {
  return {
    liftSelectedSuspension: () => liftSelectedSuspension(config),
    saveSelectedUser: () => saveSelectedUser(config),
    suspendSelectedUser: () => suspendSelectedUser(config),
  };
}
