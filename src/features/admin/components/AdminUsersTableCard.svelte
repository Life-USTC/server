<script lang="ts">
import CollectionEmpty from "#lib/components/CollectionEmpty.svelte";
import ResponsiveCollection from "#lib/components/ResponsiveCollection.svelte";
import ResultsSummary from "#lib/components/ResultsSummary.svelte";
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

  {#if users.length === 0}
    <CollectionEmpty variant="compact" description={copy.noResults} />
  {:else}
    <ResponsiveCollection>
      {#snippet mobile()}
        <AdminUsersMobileList
          {copy}
          {displayName}
          {formatDate}
          {onSelect}
          {suspensionLabel}
          {users}
        />
      {/snippet}
      {#snippet desktop()}
        <AdminUsersDesktopTable
          {copy}
          {displayName}
          {formatDate}
          {onSelect}
          {suspensionLabel}
          {users}
        />
      {/snippet}
    </ResponsiveCollection>
  {/if}
</section>
