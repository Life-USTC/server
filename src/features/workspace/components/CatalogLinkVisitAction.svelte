<script lang="ts">
export let visitCountLabel: string | undefined = undefined;
export let readOnlyReason: string | undefined = undefined;

import * as Item from "#lib/components/ui/item/index.js";
import { cn } from "#lib/utils.js";
import { catalogLinkVisitHref } from "@/features/catalog-links/lib/catalog-links";
import type { WorkspaceOverviewLinkItem } from "@/features/workspace/lib/workspace-controller-helpers";

export let link: WorkspaceOverviewLinkItem;
export let linkIconLabel: (icon: string) => string;
export let reserveActionSpace = false;

function visitLinkClass(props: Record<string, unknown>) {
  return cn(props.class as string, "bg-background hover:bg-muted text-left");
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
      <svelte:element
            this={readOnlyReason ? "button" : "a"}
            disabled={readOnlyReason ? true : undefined}
            type={readOnlyReason ? "button" : undefined}
            title={readOnlyReason}
        {...props}
        class={visitLinkClass(props)}
        href={readOnlyReason ? undefined : catalogLinkVisitHref(link.slug)}
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
          {#if readOnlyReason && visitCountLabel}<p class="text-muted-foreground text-xs">{visitCountLabel}: {link.clickCount}</p>{/if}
        </Item.Content>
      </svelte:element>
    {/snippet}
  </Item.Root>
</div>
