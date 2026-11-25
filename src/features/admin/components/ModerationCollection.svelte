<script lang="ts" generics="T extends { id: string | number }">
import type { Snippet } from "svelte";
import CollectionEmpty from "#lib/components/CollectionEmpty.svelte";
import CollectionListShell from "#lib/components/CollectionListShell.svelte";
import CollectionTableShell from "#lib/components/CollectionTableShell.svelte";
import MobileListCard from "#lib/components/MobileListCard.svelte";
import ResponsiveCollection from "#lib/components/ResponsiveCollection.svelte";
import * as Item from "#lib/components/ui/item/index.js";
import type {
  AdminModerationFilterControls,
  AdminModerationFilterKind,
} from "./admin-moderation-page-types";

let {
  fields,
  filterControls,
  items,
  label,
  mobileTestId,
  emptyDescription,
  card,
  desktop,
}: {
  fields: AdminModerationFilterKind[];
  filterControls: AdminModerationFilterControls;
  items: T[];
  label: string;
  mobileTestId?: string;
  emptyDescription: string;
  card: Snippet<[T]>;
  desktop: Snippet<[Snippet]>;
} = $props();
</script>

{#snippet emptyState()}
  <CollectionEmpty variant="compact" description={emptyDescription} />
{/snippet}

{#snippet desktopTable()}
  <div class="min-w-0">
    <CollectionTableShell {label}>
      {@render desktop(emptyState)}
    </CollectionTableShell>
  </div>
{/snippet}

<ResponsiveCollection desktop={desktopTable}>
  {#snippet mobile()}
    <div class="mb-3 flex flex-wrap items-center gap-2" data-slot="collection-header">
      {#each fields as field (field)}
        {@render filterControls(field, "mobile")}
      {/each}
    </div>
    {#if items.length === 0}
      {@render emptyState()}
    {:else}
      <CollectionListShell>
        <Item.Group class="gap-0" data-testid={mobileTestId}>
          {#each items as item, index (item.id)}
            <MobileListCard>{@render card(item)}</MobileListCard>
            {#if index < items.length - 1}<Item.Separator class="my-0" />{/if}
          {/each}
        </Item.Group>
      </CollectionListShell>
    {/if}
  {/snippet}
</ResponsiveCollection>
