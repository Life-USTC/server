<script lang="ts">
import { toast } from "@ui-sdk/svelte/toast";
import EndlessScroll from "#lib/components/EndlessScroll.svelte";
import PageHeader from "#lib/components/PageHeader.svelte";
import * as Alert from "#lib/components/ui/alert/index.js";
import { Badge } from "#lib/components/ui/badge/index.js";
import AdminUserDialog from "@/features/admin/components/AdminUserDialog.svelte";
import AdminUsersTableCard from "@/features/admin/components/AdminUsersTableCard.svelte";
import AdminWorkspace from "@/features/admin/components/AdminWorkspace.svelte";
import type { AdminUserRow } from "@/features/admin/components/admin-user-types";
import { SUSPENSION_DURATION_OPTIONS } from "@/features/admin/constants";
import {
  adminUserDisplayName,
  adminUserSuspensionLabel,
} from "@/features/admin/lib/admin-users-display";
import { createAdminUsersPageActions } from "@/features/admin/lib/admin-users-page-actions";
import { createEndlessList } from "@/lib/navigation/endless-list.svelte";
import { tableFilterPageHref } from "@/lib/table-filter-query";
import { createCampusTimestampFormatter } from "@/lib/time/shanghai-format";
import { goto } from "$app/navigation";
import type { PageData } from "./$types";

let { data }: { data: PageData } = $props();
const feed = createEndlessList<PageData, AdminUserRow>({
  source: () => data,
  select: (value) => ({ items: value.users, ...value.pagination }),
  key: (row) => row.id,
  pageHref: (next) => tableFilterPageHref("/admin/users", data.filters, next),
});

const form = $state({
  editIsAdmin: false,
  editName: "",
  editUsername: "",
  isLiftingSuspension: false,
  isSaving: false,
  isSuspending: false,
  message: null as string | null,
  messageVariant: "default" as "destructive" | "default",
  selectedUser: null as AdminUserRow | null,
  suspendDuration: "3d",
  suspendExpiresAt: "",
  suspendReason: "",
});
const copy = $derived(data.copy.adminUsers);
const commonCopy = $derived(data.copy.common);
const moderationCopy = $derived(data.copy.moderation);
const formatDate = $derived(createCampusTimestampFormatter(data.locale));
const suspendDurationOptions = $derived(
  SUSPENSION_DURATION_OPTIONS.map((option) => ({
    value: option.value,
    label: moderationCopy[option.labelKey],
  })),
);

function suspensionLabel(user: AdminUserRow) {
  return adminUserSuspensionLabel(user, copy, moderationCopy, formatDate);
}

function openDialog(user: AdminUserRow) {
  form.selectedUser = user;
  form.editName = user.name ?? "";
  form.editUsername = user.username ?? "";
  form.editIsAdmin = user.isAdmin;
  form.suspendDuration = "3d";
  form.suspendExpiresAt = "";
  form.suspendReason = "";
  form.message = null;
  form.messageVariant = "default";
}

function closeDialog() {
  form.selectedUser = null;
}

function replaceUser(updated: AdminUserRow) {
  const previous = feed.items.find((user) => user.id === updated.id);
  if (!previous) return;
  const merged = { ...previous, ...updated };
  form.selectedUser = merged;
  feed.updateItem(merged);
}

const { liftSelectedSuspension, saveSelectedUser, suspendSelectedUser } =
  createAdminUsersPageActions({
    closeDialog,
    getCopy: () => copy,
    getEditState: () => ({
      isAdmin: form.editIsAdmin,
      name: form.editName,
      username: form.editUsername,
    }),
    getSelectedUser: () => form.selectedUser,
    onSuccess: (action) => {
      toast.success(
        action === "update"
          ? copy.updateSuccess
          : action === "suspend"
            ? copy.suspendSuccess
            : copy.liftSuccess,
      );
      form.message = null;
    },
    getSuspendState: () => ({
      duration: form.suspendDuration,
      expiresAt: form.suspendExpiresAt,
      reason: form.suspendReason,
    }),
    replaceUser,
    setLiftingSuspension: (value) => {
      form.isLiftingSuspension = value;
    },
    setMessage: (value) => {
      form.message = value;
    },
    setMessageVariant: (value) => {
      form.messageVariant = value;
    },
    setSaving: (value) => {
      form.isSaving = value;
    },
    setSuspending: (value) => {
      form.isSuspending = value;
    },
  });
let draft = $derived<Record<string, string>>({ ...data.filters });
function change(patch: Record<string, string>) {
  draft = { ...draft, ...patch };
}
function apply(event: SubmitEvent) {
  event.preventDefault();
  void goto(tableFilterPageHref("/admin/users", draft));
}
</script>

<svelte:head><title>{copy.title} - Life@USTC</title></svelte:head>

<AdminWorkspace>
  {#snippet header()}
    <PageHeader title={copy.title} description={copy.subtitle} eyebrow={data.copy.admin.title}>
      {#snippet meta()}
        <div class="flex items-center gap-2 text-sm">
          <span class="text-muted-foreground">{copy.currentFilter}</span>
          <Badge variant="secondary">{data.filters.search || copy.allUsers}</Badge>
        </div>
      {/snippet}
    </PageHeader>
  {/snippet}
  {#snippet feedback()}
    {#if form.message && form.messageVariant === "destructive"}<Alert.Message variant={form.messageVariant}>{form.message}</Alert.Message>{/if}
  {/snippet}
  <AdminUsersTableCard
    {commonCopy}
    values={draft}
    onchange={change}
    onapply={apply}
    {copy}
    displayName={adminUserDisplayName}
    {formatDate}
    onSelect={openDialog}
    {suspensionLabel}
    users={feed.items}
  />

  <EndlessScroll state={feed} labels={commonCopy.endlessScroll} />
</AdminWorkspace>

<AdminUserDialog
  close={closeDialog}
  {copy}
  bind:editIsAdmin={form.editIsAdmin}
  bind:editName={form.editName}
  bind:editUsername={form.editUsername}
  isLiftingSuspension={form.isLiftingSuspension}
  isSaving={form.isSaving}
  isSuspending={form.isSuspending}
  {liftSelectedSuspension}
  message={form.message}
  messageVariant={form.messageVariant}
  {moderationCopy}
  {saveSelectedUser}
  selectedUser={form.selectedUser}
  bind:suspendDuration={form.suspendDuration}
  {suspendDurationOptions}
  bind:suspendExpiresAt={form.suspendExpiresAt}
  bind:suspendReason={form.suspendReason}
  {suspendSelectedUser}
  {suspensionLabel}
/>
