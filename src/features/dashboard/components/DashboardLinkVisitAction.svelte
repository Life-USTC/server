<script lang="ts">
import type { DashboardOverviewLinkItem } from "@/features/dashboard/lib/dashboard-controller-helpers";
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
  "h-full min-w-0 text-left",
  variant === "row" ? "min-h-14" : "min-h-20 items-start",
  reserveActionSpace && "pr-16",
);
$: contentClass =
  variant === "row"
    ? "min-w-0 sm:grid sm:grid-cols-[minmax(10rem,16rem)_1fr] sm:items-center sm:gap-4"
    : "";
$: titleClass = variant === "row" ? "line-clamp-1" : "line-clamp-2";
$: descriptionClass = variant === "row" ? "line-clamp-1" : "line-clamp-2";

function visitButtonClass(props: Record<string, unknown>) {
  return cn(props.class as string, "bg-background text-left hover:bg-muted");
}
</script>

<form
  action="/api/dashboard-links/visit"
  class="h-full"
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
          class="size-8 rounded-md border bg-muted font-semibold text-[0.6875rem] text-primary"
          variant="icon"
        >
          {linkIconLabel(link.icon)}
        </Item.Media>
        <Item.Content class={contentClass}>
          <Item.Title class={titleClass}>{link.title}</Item.Title>
          <Item.Description class={descriptionClass}>
            {link.description}
          </Item.Description>
        </Item.Content>
      </button>
    {/snippet}
  </Item.Root>
</form>
