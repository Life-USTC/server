<script lang="ts">
import type { Component } from "svelte";
import { cn } from "$lib/utils.js";

type DetailSectionNavItem = {
  href: string;
  icon?: Component;
  label: string;
  meta?: string | number;
};

export let ariaLabel: string;
export let activeHref = "";
export let items: DetailSectionNavItem[];
export let label = "";
</script>

<aside
  class="w-full shrink-0 border-base-300 border-b bg-base-100 lg:h-full lg:min-h-0 lg:border-r lg:border-b-0"
  data-testid="detail-section-nav"
>
  <nav aria-label={ariaLabel || label} class="h-full overflow-y-auto p-2">
    {#if label}
      <p class="px-2.5 pt-2 pb-1 font-medium text-[0.68rem] text-base-content/50 uppercase tracking-normal">
        {label}
      </p>
    {/if}
    <ol class="grid gap-0.5">
      {#each items as item}
        {@const active = item.href === activeHref}
        <li>
          <a
            class={cn(
              "detail-section-nav-link flex min-h-10 items-center justify-between gap-2 rounded-md px-2.5 py-2 text-sm no-underline transition-colors",
              active
                ? "bg-base-200 font-medium text-base-content"
                : "text-base-content/70 hover:bg-base-200/70 hover:text-base-content",
            )}
            href={item.href}
            aria-current={active ? "page" : undefined}
          >
            <span class="flex min-w-0 items-center gap-2">
              {#if item.icon}
                <span class="detail-section-nav-icon" aria-hidden="true">
                  <svelte:component this={item.icon} />
                </span>
              {/if}
              <span class="truncate">{item.label}</span>
            </span>
            {#if item.meta !== undefined && item.meta !== ""}
              <span
                class={cn(
                  "rounded-sm px-1.5 py-0.5 text-xs tabular-nums",
                  active
                    ? "bg-base-100 text-base-content/70"
                    : "bg-base-200 text-base-content/60",
                )}
              >
                {item.meta}
              </span>
            {/if}
          </a>
        </li>
      {/each}
    </ol>
  </nav>
</aside>

<style>
  .detail-section-nav-icon :global(svg) {
    width: 1rem;
    height: 1rem;
    flex-shrink: 0;
  }
</style>
