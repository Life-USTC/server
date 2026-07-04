<script lang="ts">
import type {
  AnonymousLinkGroup,
  DashboardDashboardCopy,
  LinkView,
} from "@/features/dashboard/lib/dashboard-controller-helpers";
import { Button } from "$lib/components/ui/button/index.js";
import * as Empty from "$lib/components/ui/empty/index.js";
import AnonymousLinksGroup from "./AnonymousLinksGroup.svelte";
import AnonymousLinksToolbar from "./AnonymousLinksToolbar.svelte";

export let dashboardCopy: DashboardDashboardCopy;
export let linkIconLabel: (icon: string) => string;
export let setLinkView: (view: LinkView) => void;

export let linkSearchQuery: string;
export let linkView: LinkView;
export let linkSearchInput: HTMLInputElement | null;
export let anonymousLinkGroups: AnonymousLinkGroup[];
</script>

<section class="grid gap-4">
  <AnonymousLinksToolbar
    {dashboardCopy}
    bind:linkSearchInput
    bind:linkSearchQuery
    {linkView}
    {setLinkView}
  />

  {#each anonymousLinkGroups as entry}
    <AnonymousLinksGroup
      {entry}
      {linkIconLabel}
      {linkView}
    />
  {:else}
    <Empty.Root class="items-start border border-border bg-background text-left">
      <Empty.Header class="items-start text-left">
        <Empty.Title>{dashboardCopy.linkHub.empty}</Empty.Title>
      </Empty.Header>
    </Empty.Root>
  {/each}

  <p class="text-base-content/60 text-xs">
    {dashboardCopy.linkHub.credit}
    <Button
      class="h-auto p-0 text-xs"
      href="https://github.com/SmartHypercube/ustclife"
      rel="noreferrer"
      target="_blank"
      variant="link"
    >
      SmartHypercube/ustclife
    </Button>{dashboardCopy.linkHub.creditSuffix}
  </p>
</section>
