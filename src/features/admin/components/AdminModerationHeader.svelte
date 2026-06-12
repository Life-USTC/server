<script lang="ts">
import PageHeader from "$lib/components/PageHeader.svelte";
import PageHeaderMeta from "$lib/components/PageHeaderMeta.svelte";
import { Badge } from "$lib/components/ui/badge/index.js";
import * as Breadcrumb from "$lib/components/ui/breadcrumb/index.js";
import { Button } from "$lib/components/ui/button/index.js";
import * as Tabs from "$lib/components/ui/tabs/index.js";
import type {
  AdminModerationAdminCopy,
  AdminModerationCommonCopy,
  AdminModerationCopy,
  AdminModerationHeaderTab,
  AdminModerationTab,
} from "./admin-moderation-page-types";

export let adminCopy: AdminModerationAdminCopy;
export let commonCopy: AdminModerationCommonCopy;
export let copy: AdminModerationCopy;
export let currentTab: AdminModerationTab;
export let isRefreshing: boolean;
export let moderationHref: (tab: AdminModerationTab) => string;
export let refreshQueue: () => void | Promise<void>;
export let tabs: AdminModerationHeaderTab[];

$: currentTabLabel = tabs.find(([id]) => id === currentTab)?.[1] ?? currentTab;
</script>

<PageHeader title={copy.title} description={copy.pageDescription} eyebrow={adminCopy.title}>
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
  {#snippet actions()}
    <Button
      class="w-full sm:w-auto"
      disabled={isRefreshing}
      type="button"
      variant="outline"
      onclick={refreshQueue}
    >
      {isRefreshing ? copy.refreshingQueue : copy.refreshQueue}
    </Button>
  {/snippet}
  {#snippet meta()}
    <PageHeaderMeta label={copy.currentView} value={currentTabLabel} />
  {/snippet}
</PageHeader>

<Tabs.Root aria-label={copy.tabsLabel}>
  <Tabs.List class="max-w-full">
    {#each tabs as [id, label, count]}
      <Tabs.Link href={moderationHref(id)} selected={currentTab === id}>
        {label}
        <Badge class="ml-2" variant="ghost">{count}</Badge>
      </Tabs.Link>
    {/each}
  </Tabs.List>
</Tabs.Root>
