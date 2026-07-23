<script lang="ts">
import type { DashboardOverviewLinkItem } from "@/features/dashboard/lib/dashboard-controller-helpers";
import TruncatedText from "$lib/components/TruncatedText.svelte";
import * as Item from "$lib/components/ui/item/index.js";
import { cn } from "$lib/utils.js";

export let link: DashboardOverviewLinkItem;
export let linkIconLabel: (icon: string) => string;
export let reserveActionSpace = false;
export let variant: "card" | "row" = "card";

$: itemVariant = (variant === "row" ? "default" : "outline") as
  | "default"
  | "outline";
$: itemClass = cn(
  "h-full min-w-0 overflow-hidden text-left",
  variant === "row" ? "min-h-14" : "min-h-24 items-start",
  reserveActionSpace && "pe-12",
);
$: contentClass =
  variant === "row"
    ? "min-w-0 sm:grid sm:grid-cols-[minmax(10rem,16rem)_1fr] sm:items-center sm:gap-4"
    : "min-w-0";
function visitButtonClass(props: Record<string, unknown>) {
  return cn(props.class as string, "bg-background text-left hover:bg-muted");
}
</script>

<form
  action="/api/workspace/links/visit"
  class="h-full min-w-0"
  method="POST"
  rel="noopener"
  target="_blank"
>
  <input name="slug" type="hidden" value={link.slug} />
  <Item.Root class={itemClass} variant={itemVariant}>
    {#snippet child({ props })}
      <button {...props} class={visitButtonClass(props)} type="submit">
        <Item.Media
          aria-hidden="true"
          class="size-8"
          variant="icon"
        >
          {linkIconLabel(link.icon)}
        </Item.Media>
        <Item.Content class={contentClass}>
          {#if variant === "row"}
            <Item.Title class="line-clamp-none w-full min-w-0">
              <TruncatedText text={link.title} />
            </Item.Title>
            <Item.Description class="line-clamp-none w-full min-w-0">
              <TruncatedText text={link.description} />
            </Item.Description>
          {:else}
            <Item.Title class="line-clamp-2">{link.title}</Item.Title>
            <Item.Description class="line-clamp-2">
              {link.description}
            </Item.Description>
          {/if}
        </Item.Content>
      </button>
    {/snippet}
  </Item.Root>
</form>
