<script lang="ts">
import PageHeader from "$lib/components/PageHeader.svelte";
import PageHeaderMeta from "$lib/components/PageHeaderMeta.svelte";
import { Badge } from "$lib/components/ui/badge/index.js";
import { Button } from "$lib/components/ui/button/index.js";
import * as Tabs from "$lib/components/ui/tabs/index.js";
import type {
  AdminModerationAdminCopy,
  AdminModerationCopy,
  AdminModerationHeaderTab,
  AdminModerationTab,
} from "./admin-moderation-page-types";

export let adminCopy: AdminModerationAdminCopy;
export let copy: AdminModerationCopy;
export let currentTab: AdminModerationTab;
export let isRefreshing: boolean;
export let moderationHref: (tab: AdminModerationTab) => string;
export let refreshQueue: () => void | Promise<void>;
export let tabs: AdminModerationHeaderTab[];

$: currentTabLabel = tabs.find(([id]) => id === currentTab)?.[1] ?? currentTab;
</script>

<PageHeader title={copy.title} description={copy.pageDescription} eyebrow={adminCopy.title}>
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

<Tabs.Root value={currentTab}>
  <Tabs.List aria-label={copy.tabsLabel} class="max-w-full">
    {#each tabs as [id, label, count]}
      <Tabs.Trigger value={id}>
        {#snippet child({ props })}
          <a href={moderationHref(id)} {...props}>
            {label}
            <Badge class="ml-2" variant="ghost">{count}</Badge>
          </a>
        {/snippet}
      </Tabs.Trigger>
    {/each}
  </Tabs.List>
</Tabs.Root>
