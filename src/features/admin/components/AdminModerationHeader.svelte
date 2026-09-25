<script lang="ts">
import PageHeader from "$lib/components/PageHeader.svelte";
import PageSectionNav from "$lib/components/PageSectionNav.svelte";
import { Button } from "$lib/components/ui/button/index.js";
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
</PageHeader>

<PageSectionNav
  ariaLabel={copy.tabsLabel}
  items={tabs.map(([id, label, count]) => ({ href: moderationHref(id), label, current: id === currentTab, meta: count }))}
/>
