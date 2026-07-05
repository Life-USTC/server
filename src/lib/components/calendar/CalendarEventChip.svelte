<script lang="ts">
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

function toneClass() {
  const currentTone = tone ?? "primary";
  if (currentTone === "warning") {
    return "border-warning/25 bg-warning/10 hover:border-warning/45 hover:bg-warning/15";
  }
  if (currentTone === "success") {
    return "border-success/25 bg-success/10 hover:border-success/45 hover:bg-success/15";
  }
  if (currentTone === "info") {
    return "border-info/25 bg-info/10 hover:border-info/45 hover:bg-info/15";
  }
  if (currentTone === "error") {
    return "border-destructive/25 bg-destructive/10 hover:border-destructive/45 hover:bg-destructive/15";
  }
  if (currentTone === "neutral") {
    return "border-border bg-background hover:border-primary/45 hover:bg-muted/50";
  }
  return "border-primary/25 bg-primary/10 hover:border-primary/45 hover:bg-primary/15";
}

$: tooltipText = tooltip || title || label;
</script>

<Tooltip.Root>
  <Tooltip.Trigger>
    {#snippet child({ props })}
      <a
        class={cn(
          "block min-w-0 rounded-md border px-2 py-1.5 text-xs no-underline transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30",
          toneClass(),
          done ? "grayscale opacity-60" : undefined,
        )}
        {href}
        {...props}
      >
        <span class="block truncate font-medium">{label}</span>
        {#if title}
          <span class="block truncate text-muted-foreground">{title}</span>
        {/if}
        {#if meta}
          <span class="block truncate text-muted-foreground">{meta}</span>
        {/if}
        {#if detail}
          <span class="block truncate text-muted-foreground">{detail}</span>
        {/if}
      </a>
    {/snippet}
  </Tooltip.Trigger>
  <Tooltip.Content>{tooltipText}</Tooltip.Content>
</Tooltip.Root>
