<script lang="ts">
import CollectionEmpty from "#lib/components/CollectionEmpty.svelte";
import ResponsiveCollection from "#lib/components/ResponsiveCollection.svelte";
import ResultsSummary from "#lib/components/ResultsSummary.svelte";
import AdminUsersDesktopTable from "./AdminUsersDesktopTable.svelte";
import AdminUsersMobileList from "./AdminUsersMobileList.svelte";
import AdminUsersSearchCard from "./AdminUsersSearchCard.svelte";
import type {
  AdminUserFormatter,
  AdminUserRow,
  AdminUsersCommonCopy,
  AdminUsersCopy,
  AdminUsersPagination,
} from "./admin-user-types";

export let commonCopy: AdminUsersCommonCopy;
export let search: string;
export let copy: AdminUsersCopy & {
  accountsDescription: string;
  accountsTitle: string;
  noResults: string;
  showing: string;
  showingOne: string;
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
  <ResultsSummary
    summary={formatMessage(pagination.total === 1 ? copy.showingOne : copy.showing, {
        count: String(users.length),
        total: String(pagination.total),
      })}
  />

    <ResponsiveCollection>
      {#snippet mobile()}
        <div class="mb-3 flex flex-wrap items-center gap-2" data-slot="collection-header">
          <AdminUsersSearchCard id="admin-user-search-mobile" {commonCopy} {copy} {search} />
        </div>
        {#if users.length === 0}<CollectionEmpty variant="compact" description={copy.noResults} />{:else}
        <AdminUsersMobileList
          {copy}
          {displayName}
          {formatDate}
          {onSelect}
          {suspensionLabel}
          {users}
        />
        {/if}
      {/snippet}
      {#snippet desktop()}
        <AdminUsersDesktopTable
          {commonCopy}
          {search}
          noResults={copy.noResults}
          {copy}
          {displayName}
          {formatDate}
          {onSelect}
          {suspensionLabel}
          {users}
        />
      {/snippet}
    </ResponsiveCollection>
</section>
