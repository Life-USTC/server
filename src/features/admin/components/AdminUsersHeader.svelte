<script lang="ts">
import PageHeader from "$lib/components/PageHeader.svelte";
import PageHeaderMeta from "$lib/components/PageHeaderMeta.svelte";
import type { AdminUsersAdminCopy, AdminUsersCopy } from "./admin-user-types";

export let adminCopy: AdminUsersAdminCopy;
export let copy: AdminUsersCopy;
export let search: string;
</script>

<PageHeader title={copy.title} description={copy.subtitle} eyebrow={adminCopy.title}>
  {#snippet meta()}
    <PageHeaderMeta label={copy.currentFilter} value={search || copy.allUsers} />
  {/snippet}
</PageHeader>
