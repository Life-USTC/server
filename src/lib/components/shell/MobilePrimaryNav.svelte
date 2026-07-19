<script lang="ts">
import * as Sidebar from "$lib/components/ui/sidebar/index.js";
import type { LayoutCopy } from "$lib/shell/layout-server-data";
import { cn } from "$lib/utils.js";
import type { ShellLink } from "./types";

let {
  copy,
  hasSecondaryCurrent,
  isActiveLink,
  links,
}: {
  copy: LayoutCopy;
  hasSecondaryCurrent: boolean;
  isActiveLink: (link: ShellLink) => boolean;
  links: ShellLink[];
} = $props();

// biome-ignore lint/correctness/useHookAtTopLevel: useSidebar is a Svelte context helper, not a React hook
const sidebar = Sidebar.useSidebar();
</script>

<nav
  aria-label={copy.shell.mobilePrimaryNavigation}
  data-shell-navigation="mobile-primary"
  class="bg-card/95 fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
>
  {#each links as link}
    {@const active =
      isActiveLink(link) && !(sidebar.openMobile && hasSecondaryCurrent)}
    <a
      aria-current={active ? "page" : undefined}
      class={cn(
        "text-muted-foreground flex min-h-14 min-w-11 flex-col items-center justify-center gap-1 px-1 text-[0.7rem] font-medium",
        active && "bg-accent text-accent-foreground",
      )}
      data-active={active}
      href={link.href}
      onclick={() => sidebar.setOpenMobile(false)}
    >
      {#if link.icon}
        {@const Icon = link.icon}
        <Icon class="size-5" />
      {/if}
      <span>{link.label}</span>
    </a>
  {/each}
</nav>
