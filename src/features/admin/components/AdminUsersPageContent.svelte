<script lang="ts">
import { goto } from "$app/navigation";
import * as Alert from "$lib/components/ui/alert/index.js";
import * as Pagination from "$lib/components/ui/pagination/index.js";
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

function handlePageChange(page: number) {
  if (page === pagination.page) return;
  void goto(pageHref(page));
}
</script>

<section class="grid gap-5">
  <AdminUsersHeader
    {adminCopy}
    {copy}
    search={filters.search ?? ""}
  />

  {#if message}<Alert.Root><Alert.Description>{message}</Alert.Description></Alert.Root>{/if}

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

  {#if pagination.totalPages > 1}
    <Pagination.Root
      aria-label={commonCopy.pagination}
      count={pagination.total}
      onPageChange={handlePageChange}
      page={pagination.page}
      perPage={pagination.pageSize}
    >
      {#snippet children({ pages, currentPage })}
        <Pagination.Content>
          <Pagination.Item>
            <Pagination.PrevButton aria-label={commonCopy.previousPage}>
              {commonCopy.previous}
            </Pagination.PrevButton>
          </Pagination.Item>
          {#each pages as page (page.key)}
            {#if page.type === "ellipsis"}
              <Pagination.Item>
                <Pagination.Ellipsis />
              </Pagination.Item>
            {:else}
              <Pagination.Item>
                <Pagination.Link
                  {page}
                  isActive={currentPage === page.value}
                />
              </Pagination.Item>
            {/if}
          {/each}
          <Pagination.Item>
            <Pagination.NextButton aria-label={commonCopy.nextPage}>
              {commonCopy.next}
            </Pagination.NextButton>
          </Pagination.Item>
        </Pagination.Content>
      {/snippet}
    </Pagination.Root>
  {/if}
</section>
