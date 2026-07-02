<script lang="ts">
import { cn } from "$lib/utils.js";
import type { ShellCopy, ShellLink, ShellNavGroup } from "./types";

export let copy: ShellCopy;
export let isActiveLink: (link: ShellLink) => boolean;
export let navGroups: ShellNavGroup[];
</script>

<aside class="hidden h-screen min-h-0 overflow-hidden border-base-300 border-r bg-base-100 lg:sticky lg:top-0 lg:flex lg:flex-col">
  <div class="flex h-12 shrink-0 items-center border-base-300 border-b px-3">
    <a
      id="app-logo"
      class="inline-flex min-w-0 items-center gap-2 rounded-md font-semibold text-base leading-none transition-opacity hover:opacity-75"
      href="/"
    >
      <img
        class="size-6 rounded-md"
        src="/images/icon.png"
        alt=""
        aria-hidden="true"
      />
      <span class="truncate">Life@USTC</span>
    </a>
  </div>

  <nav aria-label={copy.shell.primaryNavigation} class="min-h-0 flex-1 overflow-y-auto p-2.5">
    <div class="grid gap-3.5">
      {#each navGroups as group}
        <section class="grid gap-0.5" aria-label={group.label}>
          <p class="px-2 font-medium text-[0.68rem] text-base-content/50 uppercase tracking-normal">
            {group.label}
          </p>
          {#each group.links as link}
            {@const active = isActiveLink(link)}
            <a
              class={cn(
                "shell-sidebar-link flex min-h-8 items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                active
                  ? "bg-base-200 font-medium text-base-content shadow-sm"
                  : "text-base-content/70 hover:bg-base-200/70 hover:text-base-content",
              )}
              href={link.href}
              aria-label={link.ariaLabel}
              aria-current={active ? "page" : undefined}
            >
              {#if link.icon}
                <svelte:component this={link.icon} />
              {/if}
              <span class="truncate">{link.label}</span>
            </a>
          {/each}
        </section>
      {/each}
    </div>
  </nav>
</aside>

<style>
  .shell-sidebar-link :global(svg) {
    width: 1rem;
    height: 1rem;
    flex-shrink: 0;
  }
</style>
