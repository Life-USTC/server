<script lang="ts">
import type { Snippet } from "svelte";
import CollectionEmpty from "#lib/components/CollectionEmpty.svelte";
import ResponsiveCollection from "#lib/components/ResponsiveCollection.svelte";
import type {
  AdminModerationFilterControls,
  AdminModerationFilterKind,
} from "./admin-moderation-page-types";

let {
  fields,
  filterControls,
  empty,
  emptyDescription,
  cards,
  desktop,
}: {
  fields: AdminModerationFilterKind[];
  filterControls: AdminModerationFilterControls;
  empty: boolean;
  emptyDescription: string;
  cards: Snippet;
  desktop: Snippet;
} = $props();
</script>

<ResponsiveCollection {desktop}>
  {#snippet mobile()}
    <div class="mb-3 flex flex-wrap items-center gap-2" data-slot="collection-header">
      {#each fields as field (field)}
        {@render filterControls(field, "mobile")}
      {/each}
    </div>
    {#if empty}
      <CollectionEmpty variant="compact" description={emptyDescription} />
    {:else}
      {@render cards()}
    {/if}
  {/snippet}
</ResponsiveCollection>
