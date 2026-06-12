<script lang="ts">
import type { Snippet } from "svelte";
import { Badge } from "$lib/components/ui/badge/index.js";
import { cn } from "$lib/utils.js";

type Props = {
  actions?: Snippet;
  after?: Snippet;
  belowTitle?: Snippet;
  breadcrumb?: Snippet;
  class?: string;
  description?: string;
  eyebrow?: string;
  eyebrowContent?: Snippet;
  meta?: Snippet;
  title: string;
  titleClass?: string;
  titleExtra?: Snippet;
};

let {
  actions,
  after,
  belowTitle,
  breadcrumb,
  class: className = "",
  description = "",
  eyebrow = "",
  eyebrowContent,
  meta,
  title,
  titleClass = "",
  titleExtra,
}: Props = $props();
</script>

<header class={cn("grid gap-4 py-2 md:py-3", className)}>
  {#if breadcrumb}
    <div>
      {@render breadcrumb()}
    </div>
  {/if}

  <div class="flex flex-wrap items-start justify-between gap-4">
    <div class="min-w-0">
      {#if eyebrowContent}
        <div class="mb-2">
          {@render eyebrowContent()}
        </div>
      {:else if eyebrow}
        <Badge class="mb-2" variant="secondary">{eyebrow}</Badge>
      {/if}
      <h1 class={cn("break-words font-semibold text-3xl tracking-normal", titleClass)}>
        {title}{#if titleExtra}{@render titleExtra()}{/if}
      </h1>
      {#if description}
        <p class="mt-1 max-w-2xl text-base-content/60">
          {description}
        </p>
      {/if}
      {#if belowTitle}
        {@render belowTitle()}
      {/if}
    </div>

    {#if meta || actions}
      <div class="flex w-full flex-wrap items-start justify-end gap-3 sm:w-auto">
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
