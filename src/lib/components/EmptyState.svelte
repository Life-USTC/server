<script lang="ts">
import type { Component, Snippet } from "svelte";
import * as Empty from "#lib/components/ui/empty/index.js";
import { cn } from "#lib/utils.js";

let {
  title,
  description,
  icon: Icon,
  variant = "default",
  class: className,
  children,
}: {
  title?: string;
  description?: string;
  icon?: Component;
  variant?: "default" | "start" | "results";
  class?: string;
  children?: Snippet;
} = $props();
const alignment = $derived(
  variant === "default" ? undefined : "items-start text-left",
);
</script>

<Empty.Root class={cn(alignment, variant === "results" && "rounded-none border-0 p-0", className)}>
  <Empty.Header class={alignment}>
    {#if Icon}<Empty.Media variant="icon"><Icon /></Empty.Media>{/if}
    {#if title !== undefined}<Empty.Title>{title}</Empty.Title>{/if}
    {#if description !== undefined}<Empty.Description>{description}</Empty.Description>{/if}
  </Empty.Header>
  {#if children}<Empty.Content class={variant === "default" ? undefined : "items-start"}>{@render children()}</Empty.Content>{/if}
</Empty.Root>
