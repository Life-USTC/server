<script lang="ts">
import PanelLeftCloseIcon from "@lucide/svelte/icons/panel-left-close";
import PanelLeftOpenIcon from "@lucide/svelte/icons/panel-left-open";
import { Button } from "$lib/components/ui/button/index.js";
import { cn } from "$lib/utils.js";
import type { ShellCopy, ShellLink, ShellNavGroup } from "./types";

export let collapsed = false;
export let copy: ShellCopy;
export let isActiveLink: (link: ShellLink) => boolean;
export let navGroups: ShellNavGroup[];
export let setCollapsed: (collapsed: boolean) => void;
</script>

<aside
  class={cn(
    "hidden h-screen min-h-0 overflow-hidden border-base-300 border-r bg-base-100 transition-[width] duration-200 ease-out motion-reduce:transition-none lg:sticky lg:top-0 lg:flex lg:flex-col",
    collapsed ? "lg:w-16" : "lg:w-60",
  )}
  data-testid="app-sidebar"
>
  <div
    class={cn(
      "flex h-12 shrink-0 items-center border-base-300 border-b",
      collapsed ? "justify-center px-2" : "gap-2 px-3",
    )}
  >
    <a
      id="app-logo"
      class={cn(
        "inline-flex min-w-0 items-center gap-2 rounded-md font-semibold text-base leading-none transition-opacity hover:opacity-75",
        collapsed && "justify-center",
      )}
      href="/"
      aria-label={collapsed ? "Life@USTC" : undefined}
    >
      <img
        class="size-6 rounded-md"
        src="/images/icon.png"
        alt=""
        aria-hidden="true"
      />
      <span class={cn("truncate", collapsed && "lg:sr-only")}>Life@USTC</span>
    </a>
  </div>

  <nav
    aria-label={copy.shell.primaryNavigation}
    class={cn("min-h-0 flex-1 overflow-y-auto", collapsed ? "p-2" : "p-2.5")}
  >
    <div class={cn("grid", collapsed ? "gap-2.5" : "gap-3.5")}>
      {#each navGroups as group}
        <section class="grid gap-0.5" aria-label={group.label}>
          <p class={cn("px-2 font-medium text-[0.68rem] text-base-content/50 uppercase tracking-normal", collapsed && "lg:sr-only")}>
            {group.label}
          </p>
          {#each group.links as link}
            {@const active = isActiveLink(link)}
            <a
              class={cn(
                "shell-sidebar-link flex min-h-8 items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                collapsed && "justify-center",
                active
                  ? "bg-base-200 font-medium text-base-content shadow-sm"
                  : "text-base-content/70 hover:bg-base-200/70 hover:text-base-content",
              )}
              href={link.href}
              aria-label={collapsed ? (link.ariaLabel ?? link.label) : link.ariaLabel}
              aria-current={active ? "page" : undefined}
              title={collapsed ? link.label : undefined}
            >
              {#if link.icon}
                <svelte:component this={link.icon} />
              {/if}
              <span class={cn("truncate", collapsed && "lg:sr-only")}>{link.label}</span>
            </a>
          {/each}
        </section>
      {/each}
    </div>
  </nav>

  <div class={cn("flex shrink-0 border-base-300 border-t p-2", collapsed ? "justify-center" : "justify-end")}>
    <Button
      size="icon-sm"
      variant="ghost"
      aria-expanded={!collapsed}
      aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      onclick={() => setCollapsed(!collapsed)}
    >
      {#if collapsed}
        <PanelLeftOpenIcon data-icon="inline-start" />
      {:else}
        <PanelLeftCloseIcon data-icon="inline-start" />
      {/if}
    </Button>
  </div>
</aside>

<style>
  .shell-sidebar-link :global(svg) {
    width: 1rem;
    height: 1rem;
    flex-shrink: 0;
  }
</style>
