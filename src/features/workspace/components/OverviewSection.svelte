<script lang="ts">
import type { Snippet } from "svelte";
import { Button } from "$lib/components/ui/button/index.js";

type Props = {
  action?: Snippet;
  children: Snippet;
  href?: string | null;
  testId?: string;
  title: string;
  viewAllHref?: string | null;
  viewAllLabel?: string;
  viewAllVisible?: boolean;
};

let {
  action,
  children,
  href = null,
  testId,
  title,
  viewAllHref = null,
  viewAllLabel = "",
  viewAllVisible = false,
}: Props = $props();
</script>

<section class="grid gap-3" data-testid={testId}>
  <div class="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-2">
    <h2 class="text-base font-semibold tracking-tight">
      {#if href}
        <a class="hover:underline" href={href}>{title}</a>
      {:else}
        {title}
      {/if}
    </h2>
    <div class="flex flex-wrap items-center gap-2">
      {#if action}
        {@render action()}
      {/if}
      {#if viewAllVisible && viewAllHref}
        <Button class="h-auto px-0" href={viewAllHref} variant="ghost" size="sm">
          {viewAllLabel}
        </Button>
      {/if}
    </div>
  </div>
  {@render children()}
</section>
