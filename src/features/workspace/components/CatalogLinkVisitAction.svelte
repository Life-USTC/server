<script lang="ts">
import { catalogLinkVisitHref } from "@/features/catalog-links/lib/catalog-links";
import type { WorkspaceOverviewLinkItem } from "@/features/workspace/lib/workspace-controller-helpers";
import * as Item from "$lib/components/ui/item/index.js";
import { cn } from "$lib/utils.js";

export let link: WorkspaceOverviewLinkItem;
export let linkIconLabel: (icon: string) => string;
export let reserveActionSpace = false;

function visitLinkClass(props: Record<string, unknown>) {
  return cn(props.class as string, "bg-background text-left hover:bg-muted");
}
</script>

<div class="h-full min-w-0">
  <Item.Root
    class={cn(
      "h-full min-h-24 min-w-0 items-start overflow-hidden text-left",
      reserveActionSpace && "pe-12",
    )}
    variant="outline"
  >
    {#snippet child({ props })}
      <a
        {...props}
        class={visitLinkClass(props)}
        href={catalogLinkVisitHref(link.slug)}
        rel="noopener noreferrer"
        target="_blank"
      >
        <Item.Media aria-hidden="true" class="size-8" variant="icon">
          {linkIconLabel(link.icon)}
        </Item.Media>
        <Item.Content class="min-w-0">
          <Item.Title class="line-clamp-2">{link.title}</Item.Title>
          <Item.Description class="line-clamp-2">
            {link.description}
          </Item.Description>
        </Item.Content>
      </a>
    {/snippet}
  </Item.Root>
</div>
