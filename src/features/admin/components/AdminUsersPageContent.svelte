<script lang="ts">
import ListPagination from "$lib/components/ListPagination.svelte";
import * as Alert from "$lib/components/ui/alert/index.js";
import AdminUsersHeader from "./AdminUsersHeader.svelte";
import AdminUsersSearchCard from "./AdminUsersSearchCard.svelte";
import AdminUsersTableCard from "./AdminUsersTableCard.svelte";
import AdminWorkspace from "./AdminWorkspace.svelte";
import type {
  AdminUserFormatter,
  AdminUserRow,
  AdminUsersAdminCopy,
  AdminUsersCommonCopy,
  AdminUsersFilters,
  AdminUsersPageCopy,
  AdminUsersPageHref,
  AdminUsersPagination,
} from "./admin-user-types";

export let adminCopy: AdminUsersAdminCopy;
export let commonCopy: AdminUsersCommonCopy;
export let copy: AdminUsersPageCopy;
export let displayName: AdminUserFormatter;
export let filters: AdminUsersFilters;
export let formatDate: (value: Date | string | null | undefined) => string;
export let formatMessage: (
  template: string,
  values: Record<string, string>,
) => string;
export let message: string | null;
export let messageVariant: "destructive" | "default";
export let onSelect: (user: AdminUserRow) => void;
export let pageHref: AdminUsersPageHref;
export let pagination: AdminUsersPagination;
export let suspensionLabel: AdminUserFormatter;
export let users: AdminUserRow[];
</script>

<AdminWorkspace>
  {#snippet header()}
    <AdminUsersHeader
      {adminCopy}
      {copy}
      search={filters.search ?? ""}
    />
  {/snippet}
  {#snippet feedback()}
    {#if message && messageVariant === "destructive"}<Alert.Root variant={messageVariant}><Alert.Description>{message}</Alert.Description></Alert.Root>{/if}
  {/snippet}
  {#snippet controls()}
    <AdminUsersSearchCard
      {commonCopy}
      {copy}
      search={filters.search ?? ""}
    />
  {/snippet}
  <AdminUsersTableCard
    {copy}
    {displayName}
    {formatDate}
    {formatMessage}
    {onSelect}
    {pagination}
    {suspensionLabel}
    {users}
  />

  <ListPagination
    ariaLabel={commonCopy.pagination}
    nextLabel={commonCopy.next}
    nextPageLabel={commonCopy.nextPage}
    previousLabel={commonCopy.previous}
    previousPageLabel={commonCopy.previousPage}
    page={pagination.page}
    totalPages={pagination.totalPages}
    {pageHref}
  />
</AdminWorkspace>
