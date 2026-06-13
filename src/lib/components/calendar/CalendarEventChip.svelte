<script lang="ts">
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
    return "border-error/25 bg-error/10 hover:border-error/45 hover:bg-error/15";
  }
  if (currentTone === "neutral") {
    return "border-base-300 bg-base-100 hover:border-primary hover:bg-base-200/50";
  }
  return "border-primary/25 bg-primary/10 hover:border-primary/45 hover:bg-primary/15";
}
</script>

<a
  class={`block min-w-0 rounded-md border px-2 py-1.5 text-xs no-underline transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${toneClass()} ${done ? "grayscale opacity-60" : ""}`}
  {href}
  title={tooltip || title || label}
>
  <span class="block truncate font-medium">{label}</span>
  {#if title}
    <span class="block truncate text-base-content/70">{title}</span>
  {/if}
  {#if meta}
    <span class="block truncate text-base-content/55">{meta}</span>
  {/if}
  {#if detail}
    <span class="block truncate text-base-content/50">{detail}</span>
  {/if}
</a>
