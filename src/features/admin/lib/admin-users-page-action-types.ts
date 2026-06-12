import type { AdminUserRow } from "@/features/admin/components/admin-user-types";

export type AdminUsersActionCopy = {
  liftFailed: string;
  liftSuccess: string;
  suspendFailed: string;
  suspendSuccess: string;
  updateFailed: string;
  updateSuccess: string;
};

export type AdminUsersActionConfig = {
  closeDialog: () => void;
  getCopy: () => AdminUsersActionCopy;
  getEditState: () => {
    isAdmin: boolean;
    name: string;
    username: string;
  };
  getSelectedUser: () => AdminUserRow | null;
  getSuspendState: () => {
    duration: string;
    expiresAt: string;
    reason: string;
  };
  replaceUser: (user: AdminUserRow) => void;
  setLiftingSuspension: (value: boolean) => void;
  setMessage: (value: string | null) => void;
  setSaving: (value: boolean) => void;
  setSuspending: (value: boolean) => void;
};
