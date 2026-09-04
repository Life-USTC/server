<script lang="ts">
import type {
  AnonymousLinkGroup,
  WorkspaceCopy,
} from "@/features/workspace/lib/workspace-controller-helpers";
import { Button } from "$lib/components/ui/button/index.js";
import * as Empty from "$lib/components/ui/empty/index.js";
import AnonymousLinksGroup from "./AnonymousLinksGroup.svelte";
import AnonymousLinksToolbar from "./AnonymousLinksToolbar.svelte";

export let workspaceCopy: Pick<WorkspaceCopy, "linkHub">;
export let linkIconLabel: (icon: string) => string;

export let linkSearchQuery: string;
export let linkSearchInput: HTMLInputElement | null;
export let anonymousLinkGroups: AnonymousLinkGroup[];
</script>

<section class="grid gap-4">
  <AnonymousLinksToolbar
    {workspaceCopy}
    bind:linkSearchInput
    bind:linkSearchQuery
  />

  {#each anonymousLinkGroups as entry}
    <AnonymousLinksGroup
      colDescription={workspaceCopy.linkHub.colDescription}
      colName={workspaceCopy.linkHub.colName}
      {entry}
      {linkIconLabel}
    />
  {:else}
    <Empty.Root class="items-start text-left">
      <Empty.Header class="items-start text-left">
        <Empty.Title>{workspaceCopy.linkHub.empty}</Empty.Title>
      </Empty.Header>
    </Empty.Root>
  {/each}

  <p class="text-muted-foreground text-xs">
    {workspaceCopy.linkHub.credit}
    <Button
      class="h-auto p-0"
      href="https://github.com/SmartHypercube/ustclife"
      rel="noreferrer"
      target="_blank"
      variant="link"
    >
      SmartHypercube/ustclife
    </Button>{workspaceCopy.linkHub.creditSuffix}
  </p>
</section>
