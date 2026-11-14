<script lang="ts">
import ArrowLeftIcon from "@lucide/svelte/icons/arrow-left";
import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";
import PanelLeftCloseIcon from "@lucide/svelte/icons/panel-left-close";
import PanelLeftOpenIcon from "@lucide/svelte/icons/panel-left-open";
import { tick } from "svelte";
import appIconUrl from "#lib/assets/life-ustc-icon-192.png";
import * as Sidebar from "#lib/components/ui/sidebar/index.js";
import type { LayoutCopy } from "#lib/shell/layout-server-data.js";
import { cn } from "#lib/utils.js";
import {
  displayNavigationScope,
  isCurrentScopeLink,
  type NavigationScope,
  navigationScopeChildren,
  navigationScopeForLink,
  primaryDestination,
} from "./navigation-scopes";
import SettingsGlyph from "./SettingsGlyph.svelte";
import type { ShellLink } from "./types";

let {
  copy,
  currentPathname,
  footerLinks = [],
  dockAboveFooter = false,
  homeHref = "/",
  isActiveLink,
  isAncestorLink,
  scopes,
  currentScope,
  navigationOwnerKey,
}: {
  copy: LayoutCopy;
  currentPathname: string;
  footerLinks?: ShellLink[];
  dockAboveFooter?: boolean;
  homeHref?: string;
  homeLabel?: string;
  isActiveLink: (link: ShellLink) => boolean;
  isAncestorLink: (link: ShellLink) => boolean;
  scopes: Record<string, NavigationScope>;
  currentScope: string;
  navigationOwnerKey: string;
} = $props();
const sidebar = Sidebar.useSidebar();
const compactTooltips = $derived(
  !sidebar.isMobile && sidebar.state === "collapsed",
);
let preview = $state<{ owner: string; level: string } | null>(null);
const currentLevel = $derived(displayNavigationScope(scopes, currentScope));
const level = $derived(
  preview?.owner === navigationOwnerKey ? preview.level : currentLevel,
);
const scope = $derived(scopes[level] ?? scopes.root);
const scopeLinks = $derived(
  scope.groups.flatMap((group) =>
    group.links.flatMap((link) => [
      link,
      ...navigationScopeChildren(scopes, level, link),
    ]),
  ),
);
let nav: HTMLElement;
$effect(() => {
  const owner = navigationOwnerKey;
  return () => {
    if (preview?.owner === owner) preview = null;
  };
});
function changeLevel(next: string) {
  const owner = navigationOwnerKey;
  preview = { owner, level: next };
  void tick().then(() => {
    if (
      owner !== navigationOwnerKey ||
      !nav?.isConnected ||
      (sidebar.isMobile && !sidebar.openMobile)
    )
      return;
    const target =
      nav.querySelector<HTMLButtonElement>("[data-local-navigation-back]") ??
      nav.querySelector<HTMLAnchorElement>("[aria-current]") ??
      nav.querySelector<HTMLAnchorElement>(
        '[data-sidebar="menu-button"][href]',
      );
    target?.focus();
  });
}
function restoresCurrent(link: ShellLink) {
  return (
    level !== currentLevel &&
    currentLevel !== "root" &&
    ((level === "root" && link.id === primaryDestination(currentPathname)) ||
      navigationScopeForLink(
        scopes,
        scopes[currentLevel].parent ?? "root",
        link,
      )?.id === currentLevel)
  );
}
function selectDestination(event: MouseEvent, link: ShellLink) {
  if (
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.altKey ||
    event.shiftKey
  )
    return;
  if (restoresCurrent(link)) {
    event.preventDefault();
    changeLevel(currentLevel);
    return;
  }
  // Keep the clicked anchor intact until the router consumes its real href.
  // The completed navigation retires this preview through navigationOwnerKey.
  sidebar.setOpenMobile(false);
}
function revealCurrent(node: HTMLElement, active: boolean) {
  let current = false;
  let cancel = () => {};
  // A pathname change retires the old reveal owner, even if its boolean stays true.
  $effect(() => {
    currentPathname;
    return cancel;
  });
  function reveal(next: boolean) {
    if (next === current) return;
    current = next;
    cancel();
    if (!next) return;
    const owner = node.closest("nav[data-shell-navigation]");
    const viewport = node.closest('[data-slot="sidebar-content"]');
    const flow = node.closest('[data-slot="sidebar-flow"]');
    if (!owner || !viewport || !flow) return;
    const pathname = currentPathname;
    const sheet = node.closest('[data-slot="sidebar"][data-mobile="true"]');
    let cancelled = false;
    let observer: ResizeObserver | undefined;
    const stop = () => {
      cancelled = true;
      observer?.disconnect();
      for (const type of ["wheel", "touchstart", "pointerdown", "keydown"])
        owner.removeEventListener(type, stop, true);
      viewport.removeEventListener("focusin", onFocus, true);
    };
    const onFocus = (event: Event) => {
      if (event.target !== node) stop();
    };
    cancel = stop;
    // User navigation takes ownership; background data cannot restart this owner.
    for (const type of ["wheel", "touchstart", "pointerdown", "keydown"])
      owner.addEventListener(type, stop, { capture: true, passive: true });
    viewport.addEventListener("focusin", onFocus, true);
    void tick().then(() => {
      if (cancelled) return;
      observer = new ResizeObserver(() => {
        if (
          cancelled ||
          !node.isConnected ||
          currentPathname !== pathname ||
          node.closest("nav[data-shell-navigation]") !== owner ||
          node.closest('[data-slot="sidebar-content"]') !== viewport ||
          node.closest('[data-slot="sidebar-flow"]') !== flow ||
          (sheet && sheet.getAttribute("data-state") !== "open") ||
          node.closest('[data-slot="collapsible-content"][data-state="closed"]')
        ) {
          stop();
          return;
        }
        const item = node.getBoundingClientRect();
        const box = viewport.getBoundingClientRect();
        const style = getComputedStyle(viewport);
        const left = Math.max(
          0,
          box.left + Number.parseFloat(style.borderLeftWidth),
        );
        const right = Math.min(
          innerWidth,
          box.right - Number.parseFloat(style.borderRightWidth),
        );
        const top = Math.max(
          0,
          box.top + Number.parseFloat(style.borderTopWidth),
        );
        const bottom = Math.min(
          innerHeight,
          box.bottom - Number.parseFloat(style.borderBottomWidth),
        );
        if (
          item.left < left ||
          item.right > right ||
          item.top < top ||
          item.bottom > bottom
        )
          node.scrollIntoView({ block: "nearest", inline: "nearest" });
      });
      observer.observe(flow);
      observer.observe(viewport);
    });
  }
  reveal(active);
  return { update: reveal, destroy: () => cancel() };
}
</script>

{#snippet entry(link: ShellLink, depth: number, hasChildren: boolean)}
  {@const active = (level !== "root" || new URL(link.href, "https://navigation.invalid").pathname === currentPathname) && isCurrentScopeLink(link, scopeLinks, isActiveLink)}
  {@const ancestor = !active && (isActiveLink(link) || isAncestorLink(link) || (depth === 0 && level === "root" && primaryDestination(currentPathname) === link.id))}
  <div class="relative">
    <Sidebar.MenuButton
      isActive={active}
      tooltipContent={compactTooltips ? link.label : undefined}
      class={cn(
        "h-auto min-h-11 py-2 [&>span]:whitespace-normal! [&>span]:[overflow-wrap:anywhere]",
        ancestor && "bg-sidebar-accent/50",
        link.badge != null && link.badge > 0 && "pe-14!",
      )}
      data-shell-ancestor={ancestor ? "true" : undefined}
    >
      {#snippet child({ props })}
        {#if link.disabledReason}
          <button {...props} type="button" disabled aria-label={link.label} title={link.disabledReason} data-navigation-depth={depth}>
            {@render linkLabel(link, depth, hasChildren)}
          </button>
        {:else}
          <a {...props} href={link.href}
            data-navigation-depth={depth}
            data-sveltekit-preload-data={restoresCurrent(link) ? "false" : undefined}
            data-sveltekit-preload-code={restoresCurrent(link) ? "false" : undefined}
            aria-label={link.ariaLabel ?? link.label}
            aria-current={active ? "page" : ancestor ? "location" : undefined}
            use:revealCurrent={active}
            onclick={(event) => selectDestination(event, link)}
          >{@render linkLabel(link, depth, hasChildren)}</a>
        {/if}
      {/snippet}
    </Sidebar.MenuButton>
    {#if link.badge != null && link.badge > 0}
      <Sidebar.MenuBadge class="top-1/2! -translate-y-1/2" role="img" aria-label={link.badgeLabel} data-shell-count-value={link.badge}>{link.badge}</Sidebar.MenuBadge>
    {/if}
  </div>
{/snippet}

{#snippet linkLabel(link: ShellLink, depth: number, hasChildren: boolean)}
  {#if link.icon}{@const Icon = link.icon}<Icon />{:else if link.glyph}<SettingsGlyph name={link.glyph} />{/if}
  <span class={cn("min-w-0 flex-1", depth === 0 && "font-medium")}>{link.label}</span>
  {#if hasChildren}<ChevronRightIcon class="ml-auto opacity-50 group-data-[collapsible=icon]:hidden" />{/if}
{/snippet}

<Sidebar.Root
  class={dockAboveFooter && !sidebar.isMobile
    ? "top-0! bottom-16! h-auto! max-h-none!"
    : undefined}
  mobileTitle={scope.label}
  mobileDescription={copy.shell.menu}
  closeLabel={copy.shell.closeNavigation}
  collapsible="icon"
  data-testid="app-sidebar"
>
  <nav
    bind:this={nav}
    aria-label={scope.label}
    data-shell-navigation={sidebar.isMobile ? "mobile" : "desktop"}
    data-sidebar-level={level}
    data-shell-navigation-view={level}
    data-testid={`${currentScope}-sidebar`}
    class="flex min-h-0 flex-1 flex-col"
  >
    <Sidebar.Header class={sidebar.isMobile ? "pr-12" : undefined}>
      <div class="flex items-center gap-1 group-data-[collapsible=icon]:flex-col">
        <Sidebar.Menu class="min-w-0 flex-1">
          <Sidebar.MenuItem>
            <Sidebar.MenuButton class="h-11 group-data-[collapsible=icon]:p-1!" tooltipContent={compactTooltips ? "Life@USTC" : undefined}>
              {#snippet child({ props })}
                <a {...props} href={homeHref} id="app-logo" aria-label="Life@USTC" onclick={() => sidebar.setOpenMobile(false)}>
                  <img class="size-6 rounded-md" src={appIconUrl} alt="" aria-hidden="true" />
                  <span>Life@USTC</span>
                </a>
              {/snippet}
            </Sidebar.MenuButton>
          </Sidebar.MenuItem>
        </Sidebar.Menu>
        {#if !sidebar.isMobile}
          <Sidebar.Trigger
            aria-label={copy.shell.toggleSidebar}
            title={copy.shell.toggleSidebar}
            variant="outline"
            class="size-9 shrink-0 shadow-sm group-data-[collapsible=icon]:size-8"
          >
            {#if sidebar.state === "expanded"}<PanelLeftCloseIcon />{:else}<PanelLeftOpenIcon />{/if}
          </Sidebar.Trigger>
        {/if}
      </div>
      {#if scope.parent}
        <Sidebar.Menu><Sidebar.MenuItem>
          <Sidebar.MenuButton tooltipContent={compactTooltips ? copy.shell.primaryDestinations.back.replace("{section}", scopes[scope.parent ?? "root"].label) : undefined}>
            {#snippet child({ props })}
              <button {...props} type="button" data-local-navigation-back data-testid={`${currentScope}-sidebar-back`} onclick={() => changeLevel(scope.parent ?? "root")}>
                <ArrowLeftIcon /><span>{copy.shell.primaryDestinations.back.replace("{section}", scopes[scope.parent ?? "root"].label)}</span>
              </button>
            {/snippet}
          </Sidebar.MenuButton>
        </Sidebar.MenuItem></Sidebar.Menu>
      {/if}
    </Sidebar.Header>
    <Sidebar.Content>
      {#key level}
      <div class="flex min-w-0 shrink-0 flex-col" data-slot="sidebar-flow" class:sidebar-level-enter={true}>
        {#each scope.groups as group}
          <Sidebar.Group>
            <Sidebar.GroupLabel class="group-data-[collapsible=icon]:hidden">{group.label}</Sidebar.GroupLabel>
            <Sidebar.GroupContent>
              <Sidebar.Menu>
                {#each group.links as link}
                  {@const children = navigationScopeChildren(scopes, level, link)}
                  <Sidebar.MenuItem>
                    {@render entry(link, 0, children.length > 0)}
                    {#if children.length}
                      <Sidebar.MenuSub>
                        {#each children as child}
                          <Sidebar.MenuSubItem>{@render entry(child, 1, false)}</Sidebar.MenuSubItem>
                        {/each}
                      </Sidebar.MenuSub>
                    {/if}
                  </Sidebar.MenuItem>
                {/each}
              </Sidebar.Menu>
            </Sidebar.GroupContent>
          </Sidebar.Group>
        {/each}
      </div>
      {/key}
    </Sidebar.Content>
  </nav>
  {#if !sidebar.isMobile}<Sidebar.Rail label={copy.shell.toggleSidebar} />{/if}
  {#if footerLinks.length}<Sidebar.Footer class="border-t p-2"
      ><nav
        aria-label={copy.shell.footerNavigation}
        class="flex flex-wrap gap-x-3 gap-y-1 text-xs group-data-[collapsible=icon]:hidden"
        data-shell-legal-nav
      >
        {#each footerLinks as link}<a
            href={link.href}
            rel={link.rel}
            target={link.target}
            onclick={() => sidebar.setOpenMobile(false)}
            class="py-1.5">{link.label}</a
          >{/each}
      </nav></Sidebar.Footer
    >{/if}
</Sidebar.Root>


<style>
  .sidebar-level-enter {
    animation: sidebar-level-enter 180ms ease-out;
  }
  @keyframes sidebar-level-enter {
    from { opacity: 0; transform: translateX(-0.35rem); }
    to { opacity: 1; transform: translateX(0); }
  }
  @media (prefers-reduced-motion: reduce) {
    .sidebar-level-enter { animation: none; }
  }
</style>
