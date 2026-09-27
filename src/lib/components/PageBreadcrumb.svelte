<script lang="ts">
import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";

export type PageBreadcrumbItem = {
  href?: string;
  label: string;
};

let {
  items,
  label,
}: {
  items: PageBreadcrumbItem[];
  label: string;
} = $props();
</script>

{#if items.length > 0}
  <nav aria-label={label}>
    <ol class="text-muted-foreground flex min-w-0 flex-wrap items-center gap-1 text-sm">
      {#each items as item, index (item.href ?? item.label)}
        <li class="flex min-w-0 items-center gap-1">
          {#if index > 0}
            <ChevronRightIcon class="size-3.5 shrink-0" aria-hidden="true" />
          {/if}
          {#if item.href && index < items.length - 1}
            <a class="hover:text-foreground min-w-0 truncate" href={item.href}>{item.label}</a>
          {:else}
            <span class="text-foreground min-w-0 truncate" aria-current="page">{item.label}</span>
          {/if}
        </li>
      {/each}
    </ol>
  </nav>
{/if}
