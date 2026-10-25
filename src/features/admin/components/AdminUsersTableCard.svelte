<script lang="ts">
import CollectionEmpty from "#lib/components/CollectionEmpty.svelte";
import ResponsiveCollection from "#lib/components/ResponsiveCollection.svelte";
import TableFieldFilter from "#lib/components/TableFieldFilter.svelte";
import { adminUserTableFields } from "../lib/admin-user-table-filters";
import AdminUsersDesktopTable from "./AdminUsersDesktopTable.svelte";
import AdminUsersMobileList from "./AdminUsersMobileList.svelte";
import AdminUsersSearchCard from "./AdminUsersSearchCard.svelte";
import type {
  AdminUserFormatter,
  AdminUserRow,
  AdminUsersCommonCopy,
  AdminUsersCopy,
} from "./admin-user-types";

export let commonCopy: AdminUsersCommonCopy;
export let values: Record<string, string>;
export let onchange: (patch: Record<string, string>) => void;
export let onapply: (event: SubmitEvent) => void;
export let copy: AdminUsersCopy & {
  accountsDescription: string;
  accountsTitle: string;
  noResults: string;
};
export let displayName: AdminUserFormatter;
export let formatDate: (value: Date | string | null | undefined) => string;
export let onSelect: (user: AdminUserRow) => void;
export let suspensionLabel: AdminUserFormatter;
export let users: AdminUserRow[];
$: fields = adminUserTableFields(copy);
</script>

<section class="grid min-w-0 gap-3">
    <ResponsiveCollection>
      {#snippet mobile()}
        <div class="mb-3 flex flex-wrap items-center gap-2" data-slot="collection-header">
          <AdminUsersSearchCard id="admin-user-search-mobile" {commonCopy} {copy} {values} {onchange} {onapply} />
          {#each fields as field}<TableFieldFilter label={field.label} fields={[field]} {values} {onchange} labels={commonCopy.tableFilters} idPrefix={`admin-users-mobile-${field.name}`} formId="admin-user-search-mobile-form" />{/each}
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
          {values}
          {onchange}
          {onapply}
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
