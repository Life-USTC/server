<script lang="ts">
import type { Snippet } from "svelte";
import { Badge } from "$lib/components/ui/badge/index.js";
import { cn } from "$lib/utils.js";

type Props = {
  actions?: Snippet;
  actionsClass?: string;
  after?: Snippet;
  belowTitle?: Snippet;
  class?: string;
  description?: string;
  density?: "comfortable" | "compact";
  eyebrow?: string;
  eyebrowContent?: Snippet;
  meta?: Snippet;
  title: string;
  titleClass?: string;
  titleExtra?: Snippet;
};

let {
  actions,
  actionsClass = "",
  after,
  belowTitle,
  class: className = "",
  description = "",
  density = "comfortable",
  eyebrow = "",
  eyebrowContent,
  meta,
  title,
  titleClass = "",
  titleExtra,
}: Props = $props();
</script>

<header class={cn("grid min-w-0 gap-4", density === "compact" ? "py-0 md:py-1" : "py-2 md:py-3", className)}>
  <div class="flex min-w-0 flex-wrap items-start justify-between gap-4">
    <div class="min-w-0 flex-1">
      {#if eyebrowContent}
        <div class="mb-2">
          {@render eyebrowContent()}
        </div>
      {:else if eyebrow}
        <Badge class="mb-2" variant="secondary">{eyebrow}</Badge>
      {/if}
      <h1 class={cn("break-words font-semibold tracking-normal", density === "compact" ? "text-xl sm:text-2xl" : "text-3xl", titleClass)}>
        {title}{#if titleExtra}{@render titleExtra()}{/if}
      </h1>
      {#if description}
        <p class="mt-1 max-w-2xl text-muted-foreground [overflow-wrap:anywhere]">
          {description}
        </p>
      {/if}
      {#if belowTitle}
        {@render belowTitle()}
      {/if}
    </div>

    {#if meta || actions}
      <div class={cn("flex w-full flex-wrap items-start justify-end gap-3 sm:w-auto", actionsClass)}>
        {#if meta}{@render meta()}{/if}
        {#if actions}{@render actions()}{/if}
      </div>
    {/if}
  </div>

  {#if after}
    <div>
      {@render after()}
    </div>
  {/if}
</header>
