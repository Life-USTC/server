<script lang="ts">
import { cn } from "$lib/utils.js";
import type { ShellCopy, ShellLink, ShellNavGroup } from "./types";

export let copy: ShellCopy;
export let isActiveLink: (link: ShellLink) => boolean;
export let navGroups: ShellNavGroup[];
</script>

<aside class="hidden min-h-screen border-base-300 border-r bg-base-100 lg:flex lg:flex-col">
  <div class="flex h-14 shrink-0 items-center border-base-300 border-b px-4">
    <a
      id="app-logo"
      class="inline-flex min-w-0 items-center gap-2 rounded-md font-semibold text-lg leading-none transition-opacity hover:opacity-75"
      href="/"
    >
      <img
        class="size-7 rounded-md"
        src="/images/icon.png"
        alt=""
        aria-hidden="true"
      />
      <span class="truncate">Life@USTC</span>
    </a>
  </div>

  <nav aria-label={copy.shell.primaryNavigation} class="flex-1 overflow-y-auto p-3">
    <div class="grid gap-5">
      {#each navGroups as group}
        <section class="grid gap-1" aria-label={group.label}>
          <p class="px-2 font-medium text-base-content/50 text-xs uppercase tracking-normal">
            {group.label}
          </p>
          {#each group.links as link}
            {@const active = isActiveLink(link)}
            <a
              class={cn(
                "shell-sidebar-link flex min-h-9 items-center gap-2 rounded-md px-2.5 py-2 text-sm transition-colors",
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
