<script lang="ts">
import { Alert } from "$lib/components/ui/alert/index.js";
import { Pagination } from "$lib/components/ui/pagination/index.js";
import AdminUsersHeader from "./AdminUsersHeader.svelte";
import AdminUsersSearchCard from "./AdminUsersSearchCard.svelte";
import AdminUsersTableCard from "./AdminUsersTableCard.svelte";
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
export let onSelect: (user: AdminUserRow) => void;
export let pageHref: AdminUsersPageHref;
export let pagination: AdminUsersPagination;
export let suspensionLabel: AdminUserFormatter;
export let users: AdminUserRow[];
</script>

<section class="grid gap-5">
  <AdminUsersHeader
    {adminCopy}
    {commonCopy}
    {copy}
    search={filters.search ?? ""}
  />

  {#if message}<Alert>{message}</Alert>{/if}

  <AdminUsersSearchCard
    {commonCopy}
    {copy}
    search={filters.search ?? ""}
  />

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

  <Pagination
    currentPage={pagination.page}
    getPageHref={pageHref}
    label={commonCopy.pagination}
    nextAriaLabel={commonCopy.nextPage}
    nextLabel={commonCopy.next}
    previousAriaLabel={commonCopy.previousPage}
    previousLabel={commonCopy.previous}
    totalPages={pagination.totalPages}
  />
</section>
