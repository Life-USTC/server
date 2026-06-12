<script lang="ts">
import PageHeader from "$lib/components/PageHeader.svelte";
import PageHeaderMeta from "$lib/components/PageHeaderMeta.svelte";
import * as Breadcrumb from "$lib/components/ui/breadcrumb/index.js";
import type {
  AdminUsersAdminCopy,
  AdminUsersCommonCopy,
  AdminUsersCopy,
} from "./admin-user-types";

export let adminCopy: AdminUsersAdminCopy;
export let commonCopy: AdminUsersCommonCopy;
export let copy: AdminUsersCopy;
export let search: string;
</script>

<PageHeader title={copy.title} description={copy.subtitle} eyebrow={adminCopy.title}>
  {#snippet breadcrumb()}
    <Breadcrumb.Root>
      <Breadcrumb.List>
        <Breadcrumb.Item><Breadcrumb.Link href="/">{commonCopy.home}</Breadcrumb.Link></Breadcrumb.Item>
        <Breadcrumb.Separator />
        <Breadcrumb.Item><Breadcrumb.Link href="/admin">{adminCopy.title}</Breadcrumb.Link></Breadcrumb.Item>
        <Breadcrumb.Separator />
        <Breadcrumb.Item><Breadcrumb.Page>{copy.title}</Breadcrumb.Page></Breadcrumb.Item>
      </Breadcrumb.List>
    </Breadcrumb.Root>
  {/snippet}
  {#snippet meta()}
    <PageHeaderMeta label={copy.currentFilter} value={search || copy.allUsers} />
  {/snippet}
</PageHeader>
