<script lang="ts">
type DetailSectionNavItem = {
  href: string;
  label: string;
  meta?: string | number;
};

export let ariaLabel: string;
export let items: DetailSectionNavItem[];
</script>

<nav aria-label={ariaLabel} class="lg:sticky lg:top-16 lg:max-h-[calc(100vh-5rem)] lg:overflow-y-auto" data-testid="detail-section-nav">
  <ol class="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:grid lg:gap-1 lg:overflow-visible lg:rounded-lg lg:border lg:border-base-300 lg:bg-base-100/80 lg:p-2">
    {#each items as item}
      <li class="shrink-0 lg:shrink">
        <a
          class="flex min-h-9 items-center justify-between gap-3 rounded-md border border-base-300 bg-base-100 px-3 py-2 font-medium text-base-content/70 text-sm no-underline transition hover:border-primary/40 hover:bg-base-200/60 hover:text-base-content lg:border-0 lg:bg-transparent"
          href={item.href}
        >
          <span class="truncate">{item.label}</span>
          {#if item.meta !== undefined && item.meta !== ""}
            <span class="rounded-sm bg-base-200 px-1.5 py-0.5 text-base-content/60 text-xs tabular-nums">
              {item.meta}
            </span>
          {/if}
        </a>
      </li>
    {/each}
  </ol>
</nav>
