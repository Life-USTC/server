<script lang="ts">
import * as Sidebar from "$lib/components/ui/sidebar/index.js";
import type {
  LayoutCopy,
  LayoutUserSummary,
} from "$lib/shell/layout-server-data";
import { cn } from "$lib/utils.js";
import AppUserMenu from "./AppUserMenu.svelte";
import type { ShellLink } from "./types";

let {
  avatarFallback = "",
  closeMenus,
  copy,
  currentPathname = "/",
  footerLinks,
  profileHref = "/",
  setUserMenuOpen,
  user = null,
  userMenuOpen = false,
  viewerLoading = false,
}: {
  avatarFallback?: string;
  closeMenus: () => void;
  copy: LayoutCopy;
  currentPathname?: string;
  footerLinks: ShellLink[];
  profileHref?: string;
  setUserMenuOpen: (open: boolean) => void;
  user?: LayoutUserSummary;
  userMenuOpen?: boolean;
  viewerLoading?: boolean;
} = $props();

// biome-ignore lint/correctness/useHookAtTopLevel: useSidebar is a Svelte context helper, not a React hook
const sidebar = Sidebar.useSidebar();

const showAccount = $derived(viewerLoading || Boolean(user));
const accountCollapsed = $derived(sidebar.state === "collapsed");
</script>

<footer
  class="border-border relative z-20 flex h-16 w-full shrink-0 items-stretch border-t bg-background"
>
  {#if showAccount}
    <div
      class={cn(
        "group hidden h-full shrink-0 items-center border-sidebar-border border-e bg-sidebar p-2 transition-[width] duration-200 ease-linear md:flex",
        accountCollapsed ? "w-(--sidebar-width-icon)" : "w-(--sidebar-width)",
      )}
      data-collapsible={accountCollapsed ? "icon" : ""}
      data-state={sidebar.state}
    >
      {#if viewerLoading}
        <div
          aria-hidden="true"
          class="flex h-12 w-full items-center gap-2 px-2"
          data-testid="sidebar-viewer-loading"
        >
          <div class="size-8 animate-pulse rounded-lg bg-sidebar-accent"></div>
          <div class="grid flex-1 gap-1 group-data-[collapsible=icon]:hidden">
            <div class="h-3 w-24 animate-pulse rounded bg-sidebar-accent"></div>
            <div class="h-2.5 w-16 animate-pulse rounded bg-sidebar-accent"></div>
          </div>
        </div>
      {:else if user}
        <AppUserMenu
          {avatarFallback}
          {closeMenus}
          {copy}
          {currentPathname}
          {profileHref}
          {setUserMenuOpen}
          {user}
          {userMenuOpen}
        />
      {/if}
    </div>
  {/if}

  <div
    class="flex min-w-0 flex-1 items-center justify-between gap-4 bg-background/80 px-4 text-muted-foreground text-sm sm:px-5 lg:px-6"
  >
    <nav
      aria-label={copy.shell.footerNavigation}
      class="flex min-w-0 flex-wrap items-center gap-x-5 gap-y-1"
    >
      {#each footerLinks as link}
        <a
          class="transition-colors hover:text-foreground"
          href={link.href}
          rel={link.rel}
          target={link.target}
        >
          {link.label}
        </a>
      {/each}
    </nav>
    <p class="shrink-0 text-xs">Life@USTC</p>
  </div>
</footer>
