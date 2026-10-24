<script lang="ts">
import { linkGroupSectionClass } from "@/features/workspace/lib/link-table-layout";
import type { AnonymousLinkGroup } from "@/features/workspace/lib/workspace-controller-helpers";
import CatalogLinkVisitAction from "./CatalogLinkVisitAction.svelte";

export let entry: AnonymousLinkGroup;
export let linkIconLabel: (icon: string) => string;
</script>

<section class={linkGroupSectionClass}>
  <h3 class="font-medium text-muted-foreground text-sm">
    {entry.label}
  </h3>
      <div class="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        {#each entry.links as link}
          <CatalogLinkVisitAction {link} {linkIconLabel} />
        {/each}
      </div>
</section>
