<script lang="ts">
import type {
  AdminDashboardCommonCopy,
  AdminDashboardCopy,
} from "@/features/admin/lib/admin-dashboard-card-data";
import PageHeader from "$lib/components/PageHeader.svelte";
import PageHeaderMeta from "$lib/components/PageHeaderMeta.svelte";
import * as Breadcrumb from "$lib/components/ui/breadcrumb/index.js";

export let commonCopy: AdminDashboardCommonCopy;
export let copy: AdminDashboardCopy;
export let openItems: number;
</script>

<PageHeader title={copy.title} description={copy.subtitle} eyebrow={copy.title}>
  {#snippet breadcrumb()}
    <Breadcrumb.Root>
      <Breadcrumb.List>
        <Breadcrumb.Item><Breadcrumb.Link href="/">{commonCopy.home}</Breadcrumb.Link></Breadcrumb.Item>
        <Breadcrumb.Separator />
        <Breadcrumb.Item><Breadcrumb.Page>{copy.title}</Breadcrumb.Page></Breadcrumb.Item>
      </Breadcrumb.List>
    </Breadcrumb.Root>
  {/snippet}
  {#snippet meta()}
    <PageHeaderMeta label={copy.dashboard.openItems} value={openItems} />
  {/snippet}
</PageHeader>
