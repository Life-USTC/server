<script lang="ts">
import type { Component } from "svelte";

export let description = "";
export let icon: Component;
export let title: string;
</script>

<div class="flex items-start gap-3">
  <span class="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-primary">
    <svelte:component this={icon} class="size-4" />
  </span>
  <div class="grid min-w-0 flex-1 gap-1">
    <p class="font-medium text-sm">{title}</p>
    {#if description}
      <p class="text-muted-foreground text-xs leading-5">{description}</p>
    {/if}
    <slot />
  </div>
</div>
