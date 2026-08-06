<script lang="ts">
import * as Item from "$lib/components/ui/item/index.js";
import * as Tooltip from "$lib/components/ui/tooltip/index.js";
import { cn } from "$lib/utils.js";
import type { CalendarTone } from "./types";

export let href: string | undefined = undefined;
export let label = "";
export let title = "";
export let meta = "";
export let detail = "";
export let tooltip = "";
export let tooltipDetail = "";
export let tone: CalendarTone = "primary";
export let done = false;

function eventChipProps(
  itemProps: Record<string, unknown>,
  triggerProps: Record<string, unknown>,
) {
  const { class: itemClass, ...itemRest } = itemProps;
  const { class: triggerClass, ...triggerRest } = triggerProps;

  return {
    ...itemRest,
    ...triggerRest,
    class: cn(
      typeof itemClass === "string" ? itemClass : undefined,
      typeof triggerClass === "string" ? triggerClass : undefined,
    ),
  };
}

$: tooltipBody = tooltipDetail || detail || title;
</script>

{#snippet chipContent()}
  <Item.Content class="w-full min-w-0 overflow-hidden gap-0.5">
    <Item.Title class="block w-full min-w-0 max-w-full truncate">
      {label}
    </Item.Title>
    {#if meta}
      <Item.Description class="block w-full min-w-0 max-w-full truncate">
        {meta}
      </Item.Description>
    {/if}
    {#if detail}
      <Item.Description class="block w-full min-w-0 max-w-full truncate">
        {detail}
      </Item.Description>
    {:else if title}
      <Item.Description class="block w-full min-w-0 max-w-full truncate">
        {title}
      </Item.Description>
    {/if}
  </Item.Content>
{/snippet}

{#snippet tooltipContent()}
  <div class="grid max-w-xs gap-0.5 text-left whitespace-normal">
    <div class="font-medium text-xs leading-snug">{label}</div>
    {#if meta}
      <div class="text-xs leading-snug opacity-80">{meta}</div>
    {/if}
    {#if tooltipBody}
      <div class="text-xs leading-snug break-words opacity-80">{tooltipBody}</div>
    {:else if tooltip && tooltip !== label}
      <div class="text-xs leading-snug break-words opacity-80">{tooltip}</div>
    {/if}
  </div>
{/snippet}

<Tooltip.Root>
  <Tooltip.Trigger>
    {#snippet child({ props })}
      <Item.Root
        class={cn(
          "min-w-0 overflow-hidden flex-col flex-nowrap items-stretch no-underline",
          tone === "warning"
            ? "border-warning/25 bg-warning/10 hover:border-warning/45 hover:bg-warning/15"
            : tone === "success"
              ? "border-success/25 bg-success/10 hover:border-success/45 hover:bg-success/15"
              : tone === "info"
                ? "border-info/25 bg-info/10 hover:border-info/45 hover:bg-info/15"
                : tone === "error"
                  ? "border-destructive/25 bg-destructive/10 hover:border-destructive/45 hover:bg-destructive/15"
                  : tone === "neutral"
                    ? "border-border bg-background hover:border-primary/45 hover:bg-muted/50"
                    : "border-primary/25 bg-primary/10 hover:border-primary/45 hover:bg-primary/15",
          done ? "grayscale opacity-60" : undefined,
        )}
        size="xs"
        variant="outline"
      >
        {#snippet child({ props: itemProps })}
          {#if href}
            <a {...eventChipProps(itemProps, props)} {href}>
              {@render chipContent()}
            </a>
          {:else}
            <div {...eventChipProps(itemProps, props)}>
              {@render chipContent()}
            </div>
          {/if}
        {/snippet}
      </Item.Root>
    {/snippet}
  </Tooltip.Trigger>
  <Tooltip.Content class="items-start py-2">
    {@render tooltipContent()}
  </Tooltip.Content>
</Tooltip.Root>
