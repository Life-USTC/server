<script lang="ts">
import { SUSPENSION_DURATION_OPTIONS } from "@/features/admin/constants";
import { createAdminUsersControllerDefaultState } from "@/features/admin/lib/admin-users-controller-default-state";
import {
  adminUserDisplayName,
  adminUserSuspensionLabel,
  adminUsersPageHref,
  formatAdminUserMessage,
} from "@/features/admin/lib/admin-users-display";
import { createAdminUsersPageActions } from "@/features/admin/lib/admin-users-page-actions";
import { createShanghaiDateTimeFormatter } from "@/lib/time/shanghai-format";
import AdminUserDialog from "./AdminUserDialog.svelte";
import AdminUsersPageContent from "./AdminUsersPageContent.svelte";
import type {
  AdminUserRow,
  AdminUsersAdminCopy,
  AdminUsersCommonCopy,
  AdminUsersFilters,
  AdminUsersModerationCopy,
  AdminUsersPageCopy,
  AdminUsersPagination,
} from "./admin-user-types";

type AdminUser = AdminUserRow;

type AdminUsersPageData = {
  copy: {
    admin: AdminUsersAdminCopy;
    adminUsers: AdminUsersPageCopy;
    common: AdminUsersCommonCopy;
    moderation: AdminUsersModerationCopy;
  };
  filters: AdminUsersFilters;
  locale: string;
  pagination: AdminUsersPagination;
  users: AdminUserRow[];
};

export let data: AdminUsersPageData;

let {
  editIsAdmin,
  editName,
  editUsername,
  isLiftingSuspension: _isLiftingSuspension,
  isSaving: _isSaving,
  isSuspending: _isSuspending,
  message: _message,
  selectedUser,
  suspendDuration,
  suspendExpiresAt,
  suspendReason,
  users,
} = createAdminUsersControllerDefaultState<AdminUser>({
  users: data.users,
});

$: if (data.users) users = data.users;
$: _copy = data.copy.adminUsers;
$: _commonCopy = data.copy.common;
$: _adminCopy = data.copy.admin;
$: _moderationCopy = data.copy.moderation;
$: _dateTimeFormatter = createShanghaiDateTimeFormatter(data.locale, {
  dateStyle: "medium",
  timeStyle: "short",
});
$: suspendDurationOptions = SUSPENSION_DURATION_OPTIONS.map((option) => ({
  value: option.value,
  label: _moderationCopy[option.labelKey],
}));

function inputValue(event: Event) {
  return (event.currentTarget as HTMLInputElement).value;
}

function _pageHref(page: number) {
  return adminUsersPageHref(page, data.filters.search);
}

function _formatDate(value: Date | string | null | undefined) {
  return value ? _dateTimeFormatter.format(new Date(value)) : "";
}

function _suspensionLabel(user: AdminUser) {
  return adminUserSuspensionLabel(user, _copy, _moderationCopy, _formatDate);
}

function _openDialog(user: AdminUser) {
  selectedUser = user;
  editName = user.name ?? "";
  editUsername = user.username ?? "";
  editIsAdmin = user.isAdmin;
  suspendDuration = "3d";
  suspendExpiresAt = "";
  suspendReason = "";
  _message = null;
}

function closeDialog() {
  selectedUser = null;
}

function replaceUser(updated: AdminUser) {
  users = users.map((user: AdminUser) =>
    user.id === updated.id ? { ...user, ...updated } : user,
  );
  selectedUser =
    users.find((user: AdminUser) => user.id === updated.id) ?? selectedUser;
}

const {
  liftSelectedSuspension: _liftSelectedSuspension,
  saveSelectedUser: _saveSelectedUser,
  suspendSelectedUser: _suspendSelectedUser,
} = createAdminUsersPageActions({
  closeDialog,
  getCopy: () => _copy,
  getEditState: () => ({
    isAdmin: editIsAdmin,
    name: editName,
    username: editUsername,
  }),
  getSelectedUser: () => selectedUser,
  getSuspendState: () => ({
    duration: suspendDuration,
    expiresAt: suspendExpiresAt,
    reason: suspendReason,
  }),
  replaceUser,
  setLiftingSuspension: (value) => {
    _isLiftingSuspension = value;
  },
  setMessage: (value) => {
    _message = value;
  },
  setSaving: (value) => {
    _isSaving = value;
  },
  setSuspending: (value) => {
    _isSuspending = value;
  },
});
</script>

<svelte:head><title>{_copy.title} - Life@USTC</title></svelte:head>

<AdminUsersPageContent
  adminCopy={_adminCopy}
  commonCopy={_commonCopy}
  copy={_copy}
  displayName={adminUserDisplayName}
  filters={data.filters}
  formatDate={_formatDate}
  formatMessage={formatAdminUserMessage}
  message={_message}
  onSelect={_openDialog}
  pageHref={_pageHref}
  pagination={data.pagination}
  suspensionLabel={_suspensionLabel}
  {users}
/>

<AdminUserDialog
  close={closeDialog}
  copy={_copy}
  bind:editIsAdmin
  bind:editName
  bind:editUsername
  {inputValue}
  isLiftingSuspension={_isLiftingSuspension}
  isSaving={_isSaving}
  isSuspending={_isSuspending}
  liftSelectedSuspension={_liftSelectedSuspension}
  message={_message}
  moderationCopy={_moderationCopy}
  saveSelectedUser={_saveSelectedUser}
  {selectedUser}
  bind:suspendDuration
  {suspendDurationOptions}
  bind:suspendExpiresAt
  bind:suspendReason
  suspendSelectedUser={_suspendSelectedUser}
  suspensionLabel={_suspensionLabel}
/>
