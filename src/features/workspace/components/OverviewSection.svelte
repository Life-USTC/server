<script lang="ts">
import type { Snippet } from "svelte";
import { Button } from "#lib/components/ui/button/index.js";
import { cn } from "#lib/utils.js";

type Props = {
  action?: Snippet;
  children: Snippet;
  class?: string;
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
  class: className = "",
  href = null,
  testId,
  title,
  viewAllHref = null,
  viewAllLabel = "",
  viewAllVisible = false,
}: Props = $props();
</script>

<section class={cn("grid min-w-0 content-start gap-3", className)} data-testid={testId}>
  <div class="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-2">
    <h2 class="text-base font-semibold tracking-tight">
      {#if href}
        <!-- WCAG 2.2 SC 2.5.8: the heading link keeps a 24px target. -->
        <a class="inline-flex min-h-6 items-center hover:underline" href={href}>{title}</a>
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
