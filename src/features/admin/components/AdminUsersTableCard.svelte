<script lang="ts">
import SoftEmptyMessage from "$lib/components/SoftEmptyMessage.svelte";
import { Badge } from "$lib/components/ui/badge/index.js";
import AdminUsersDesktopTable from "./AdminUsersDesktopTable.svelte";
import AdminUsersMobileList from "./AdminUsersMobileList.svelte";
import type {
  AdminUserFormatter,
  AdminUserRow,
  AdminUsersCopy,
  AdminUsersPagination,
} from "./admin-user-types";

export let copy: AdminUsersCopy & {
  accountsDescription: string;
  accountsTitle: string;
  noResults: string;
  showing: string;
};
export let displayName: AdminUserFormatter;
export let formatDate: (value: Date | string | null | undefined) => string;
export let formatMessage: (
  template: string,
  values: Record<string, string>,
) => string;
export let onSelect: (user: AdminUserRow) => void;
export let pagination: AdminUsersPagination;
export let suspensionLabel: AdminUserFormatter;
export let users: AdminUserRow[];
</script>

<section class="grid min-w-0 gap-3">
  <div class="flex justify-end">
    <Badge variant="ghost">
      {formatMessage(copy.showing, {
        count: String(users.length),
        total: String(pagination.total),
      })}
    </Badge>
  </div>

  {#if users.length === 0}
    <SoftEmptyMessage message={copy.noResults} />
  {:else}
    <AdminUsersMobileList
      {copy}
      {displayName}
      {formatDate}
      {onSelect}
      {suspensionLabel}
      {users}
    />

    <AdminUsersDesktopTable
      {copy}
      {displayName}
      {formatDate}
      {onSelect}
      {suspensionLabel}
      {users}
    />
  {/if}
</section>
