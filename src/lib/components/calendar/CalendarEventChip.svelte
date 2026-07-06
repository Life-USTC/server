<script lang="ts">
import * as Item from "$lib/components/ui/item/index.js";
import * as Tooltip from "$lib/components/ui/tooltip/index.js";
import { cn } from "$lib/utils.js";
import type { CalendarTone } from "./types";

export let href = "#";
export let label = "";
export let title = "";
export let meta = "";
export let detail = "";
export let tooltip = "";
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
    href,
  };
}

$: tooltipText = tooltip || title || label;
</script>

<Tooltip.Root>
  <Tooltip.Trigger>
    {#snippet child({ props })}
      <Item.Root
        class={cn(
          "min-w-0 no-underline",
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
          <a {...eventChipProps(itemProps, props)}>
            <Item.Content class="gap-0">
              <Item.Title class="max-w-full">{label}</Item.Title>
              {#if title}
                <Item.Description class="max-w-full line-clamp-1">{title}</Item.Description>
              {/if}
              {#if meta}
                <Item.Description class="max-w-full line-clamp-1">{meta}</Item.Description>
              {/if}
              {#if detail}
                <Item.Description class="max-w-full line-clamp-1">{detail}</Item.Description>
              {/if}
            </Item.Content>
          </a>
        {/snippet}
      </Item.Root>
    {/snippet}
  </Tooltip.Trigger>
  <Tooltip.Content>{tooltipText}</Tooltip.Content>
</Tooltip.Root>
