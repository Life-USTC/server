<script lang="ts">
import type { DashboardOverviewLinkItem } from "@/features/dashboard/lib/dashboard-controller-helpers";
import * as Item from "$lib/components/ui/item/index.js";
import { cn } from "$lib/utils.js";

export let link: DashboardOverviewLinkItem;
export let linkIconLabel: (icon: string) => string;
export let reserveActionSpace = false;

function visitButtonClass(props: Record<string, unknown>) {
  return cn(props.class as string, "bg-background text-left hover:bg-muted");
}
</script>

<form
  action="/api/catalog/links/resolve"
  class="h-full min-w-0"
  method="POST"
  rel="noopener"
  target="_blank"
>
  <input name="slug" type="hidden" value={link.slug} />
  <Item.Root
    class={cn(
      "h-full min-h-24 min-w-0 items-start overflow-hidden text-left",
      reserveActionSpace && "pe-12",
    )}
    variant="outline"
  >
    {#snippet child({ props })}
      <button {...props} class={visitButtonClass(props)} type="submit">
        <Item.Media aria-hidden="true" class="size-8" variant="icon">
          {linkIconLabel(link.icon)}
        </Item.Media>
        <Item.Content class="min-w-0">
          <Item.Title class="line-clamp-2">{link.title}</Item.Title>
          <Item.Description class="line-clamp-2">
            {link.description}
          </Item.Description>
        </Item.Content>
      </button>
    {/snippet}
  </Item.Root>
</form>
