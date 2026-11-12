<script lang="ts">
import ArrowLeftIcon from "@lucide/svelte/icons/arrow-left";
import ChevronDownIcon from "@lucide/svelte/icons/chevron-down";
import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";
import { onMount, tick } from "svelte";
import appIconUrl from "#lib/assets/life-ustc-icon-192.png";
import * as Collapsible from "#lib/components/ui/collapsible/index.js";
import * as Sidebar from "#lib/components/ui/sidebar/index.js";
import { Skeleton } from "#lib/components/ui/skeleton/index.js";
import type {
  LayoutCopy,
  LayoutUserSummary,
} from "#lib/shell/layout-server-data.js";
import { cn } from "#lib/utils.js";
import AppUserMenu from "./AppUserMenu.svelte";
import SettingsGlyph from "./SettingsGlyph.svelte";
import {
  loadSidebarPreferences,
  saveSidebarPreferences,
} from "./sidebar-preferences";
import type { ShellLink, ShellNavGroup } from "./types";

export type SectionSidebar = {
  backHref: string;
  backLabel: string;
  backTestId: string;
  level: "settings" | "young" | "admin";
  navLabel: string;
  testId: string;
};

let {
  avatarFallback,
  closeMenus,
  copy,
  currentPathname,
  dockAboveFooter = false,
  footerLinks = [],
  homeHref = "/",
  homeLabel = copy.shell.discovery.home,
  isActiveLink,
  isAncestorLink,
  navGroups,
  profileHref,
  sectionSidebar = null,
  setUserMenuOpen,
  showAccountFooter = true,
  user,
  userMenuOpen,
  viewerLoading,
}: {
  avatarFallback: string;
  closeMenus: () => void;
  copy: LayoutCopy;
  currentPathname: string;
  dockAboveFooter?: boolean;
  /** Legal/help links for catalog detail chrome (public footer omitted there). */
  footerLinks?: ShellLink[];
  homeHref?: string;
  homeLabel?: string;
  isActiveLink: (link: ShellLink) => boolean;
  isAncestorLink: (link: ShellLink) => boolean;
  navGroups: ShellNavGroup[];
  profileHref: string;
  sectionSidebar?: SectionSidebar | null;
  setUserMenuOpen: (open: boolean) => void;
  showAccountFooter?: boolean;
  user: LayoutUserSummary;
  userMenuOpen: boolean;
  viewerLoading: boolean;
} = $props();

const sidebar = Sidebar.useSidebar();
const discoveryId = $props.id();
function hintId(link: ShellLink, mobile: boolean) {
  return `${discoveryId}-${mobile ? "mobile" : "desktop"}-${link.id ?? encodeURIComponent(link.href)}`;
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
const groupOpen = $state<Record<string, boolean>>({});
let savedSubmenus = $state<Record<string, boolean>>({});
let submenuOverride = $state<Record<string, { open: boolean; path: string }>>(
  {},
);

onMount(() => {
  const saved = loadSidebarPreferences();
  Object.assign(groupOpen, saved.groups);
  savedSubmenus = saved.submenus;
});

function submenuIsOpen(key: string, autoOpen: boolean, path: string) {
  const saved = submenuOverride[key];
  if (saved?.path === path) return saved.open;
  return autoOpen || savedSubmenus[key] === true;
}

function setSubmenuOpen(key: string, path: string, open: boolean) {
  submenuOverride = { ...submenuOverride, [key]: { open, path } };
  savedSubmenus = { ...savedSubmenus, [key]: open };
  saveSidebarPreferences({
    ...loadSidebarPreferences(),
    submenus: savedSubmenus,
  });
}

function hasActiveChild(link: ShellLink): boolean {
  return (
    link.items?.some((child) => isActiveLink(child) || hasActiveChild(child)) ??
    false
  );
}

function setGroupOpen(key: string, isOpen: boolean): void {
  groupOpen[key] = isOpen;
  saveSidebarPreferences({
    ...loadSidebarPreferences(),
    groups: groupOpen,
  });
}

function showActiveState(active: boolean): boolean {
  return (
    active &&
    (sidebar.isMobile ? sidebar.openMobile : sidebar.state === "expanded")
  );
}

function closeMobileSidebar(): void {
  sidebar.setOpenMobile(false);
}
</script>

{#snippet badge(value: number | null | undefined)}
  {#if value != null && value > 0}
    <div
      class="text-sidebar-foreground ms-auto flex h-5 min-w-5 items-center justify-center rounded-md px-1 text-xs font-medium tabular-nums"
    >
      {value}
    </div>
  {/if}
{/snippet}

{#snippet navigationHint(link: ShellLink, mobile: boolean, hasChildren = false)}
  {#if link.discoveryHint}
    <details class="group-data-[collapsible=icon]:hidden" data-shell-nav-hint>
      <summary
        aria-label={link.discoveryHint.label}
        data-shell-count-value={link.badge ?? undefined}
        class={cn("absolute top-0 flex min-h-11 min-w-11 max-w-24 cursor-pointer list-none items-center justify-center gap-1 rounded-md px-1 text-xs hover:bg-sidebar-accent focus-visible:outline-2 focus-visible:outline-ring md:min-h-8 md:min-w-8 [&::-webkit-details-marker]:hidden", hasChildren ? "right-8 max-w-19" : "right-1")}
      >
        <span class="min-w-0 [overflow-wrap:anywhere]">{link.discoveryHint.text}</span><svg class="size-3 shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><circle cx="8" cy="8" r="6" /><path stroke-linecap="round" d="M8 7v4m0-7v.01" /></svg>
      </summary>
      <p id={hintId(link, mobile)} class="mx-1 mt-1 rounded-md border p-2 text-xs leading-relaxed [overflow-wrap:anywhere]" data-shell-nav-hint-body>{link.discoveryHint.description}</p>
    </details>
  {/if}
{/snippet}

{#snippet navigation(groups: ShellNavGroup[], mobile: boolean)}
  <nav
    aria-label={sectionSidebar?.navLabel ?? copy.shell.primaryNavigation}
    data-shell-navigation={mobile ? "mobile" : "desktop"}
    data-sidebar-level={sectionSidebar?.level}
    data-testid={sectionSidebar?.testId}
    class="flex min-h-0 flex-1 flex-col"
  >
    <Sidebar.Header class={mobile ? "pr-12" : undefined}>
      <Sidebar.Menu>
        <Sidebar.MenuItem>
          {#if sectionSidebar}
            {@const section = sectionSidebar}
            <Sidebar.MenuButton class="h-auto min-h-11 py-1.5" tooltipContent={!sidebar.isMobile && sidebar.state === "collapsed" ? `${homeLabel} · Life@USTC` : undefined}>
              {#snippet child({ props })}
                <a
                  {...props}
                  href={homeHref}
                  aria-label={`Life@USTC: ${homeLabel}`}
                  onclick={closeMobileSidebar}
                >
                  <img
                    class="size-6 rounded-md"
                    src={appIconUrl}
                    alt=""
                    aria-hidden="true"
                  />
                  <span class="grid min-w-0"><span>Life@USTC</span>{" "}<span class="text-xs font-normal">{homeLabel}</span></span>
                </a>
              {/snippet}
            </Sidebar.MenuButton>
            <Sidebar.MenuButton tooltipContent={!sidebar.isMobile && sidebar.state === "collapsed" ? section.backLabel : undefined}>
              {#snippet child({ props })}
                <a
                  {...props}
                  href={section.backHref}
                  data-testid={section.backTestId}
                  onclick={closeMobileSidebar}
                >
                  <ArrowLeftIcon />
                  <span>{section.backLabel}</span>
                </a>
              {/snippet}
            </Sidebar.MenuButton>
          {:else}
            <Sidebar.MenuButton class="h-auto min-h-11 py-1.5" isActive={showActiveState(currentPathname === "/")} tooltipContent={!sidebar.isMobile && sidebar.state === "collapsed" ? `${homeLabel} · Life@USTC` : undefined}>
              {#snippet child({ props })}
                <a
                  {...props}
                  id="app-logo"
                  href={homeHref}
                  aria-label={`Life@USTC: ${homeLabel}`}
                  aria-current={showActiveState(currentPathname === "/") ? "page" : undefined}
                  onclick={closeMobileSidebar}
                >
                  <img
                    class="size-6 rounded-md"
                    src={appIconUrl}
                    alt=""
                    aria-hidden="true"
                  />
                  <span class="grid min-w-0"><span>Life@USTC</span>{" "}<span class="text-xs font-normal">{homeLabel}</span></span>
                </a>
              {/snippet}
            </Sidebar.MenuButton>
          {/if}
        </Sidebar.MenuItem>
      </Sidebar.Menu>
    </Sidebar.Header>

    <Sidebar.Content>
      <div class="flex min-w-0 shrink-0 flex-col" data-slot="sidebar-flow">
      {#each groups as group, index}
        {@const isCollapsed = !mobile && sidebar.state === "collapsed"}
        {@const groupKey = group.id ?? `group-${index}`}
        {@const groupActive = group.links.some(
          (link) =>
            isActiveLink(link) || hasActiveChild(link) || isAncestorLink(link),
        )}
        {@const isOpen =
          !isCollapsed &&
          (groupActive || (groupOpen[groupKey] ?? Boolean(group.defaultOpen)))}
        <Collapsible.Root
          bind:open={() => isOpen,
          (value) => {
            // The compact rail shows one icon per intent group. Opening one
            // restores its destinations without expanding every other group.
            if (isCollapsed) {
              setGroupOpen(groupKey, true);
              sidebar.setOpen(true);
              return;
            }
            setGroupOpen(groupKey, value);
          }}
          class="group/collapsible"
        >
          <Sidebar.Group>
            <Sidebar.GroupLabel
              class={cn(
                "gap-2 overflow-hidden text-sm hover:bg-sidebar-accent hover:text-sidebar-accent-foreground group-data-[collapsible=icon]:mt-0 group-data-[collapsible=icon]:opacity-100",
                isCollapsed && groupActive && "bg-sidebar-accent text-sidebar-accent-foreground",
              )}
            >
              {#snippet child({ props })}
                <Collapsible.Trigger
                  {...props}
                  aria-label={group.label}
                  title={isCollapsed ? group.label : undefined}
                  data-active={isCollapsed && groupActive ? "true" : undefined}
                  aria-current={isCollapsed && groupActive ? "location" : undefined}
                >
                  {#if group.icon}
                    {@const GroupIcon = group.icon}
                    <GroupIcon />
                  {/if}
                  <span class="truncate">{group.label}</span>
                  <ChevronDownIcon
                    class="ms-auto transition-transform group-data-[state=open]/collapsible:rotate-180 group-data-[collapsible=icon]:hidden"
                  />
                </Collapsible.Trigger>
              {/snippet}
            </Sidebar.GroupLabel>
            <Collapsible.Content>
              <Sidebar.GroupContent>
                <Sidebar.Menu>
                  {#each group.links as link}
                    {#if link.disabledReason}
                      <Sidebar.MenuItem>
                        <Sidebar.MenuButton
                          aria-describedby="demo-unavailable"
                          title={link.disabledReason}
                        >
                          {#snippet child({ props })}
                            <button {...props} disabled type="button">
                              {#if link.glyph}
                                <SettingsGlyph name={link.glyph} />
                              {:else if link.icon}
                                {@const Icon = link.icon}
                                <Icon />
                              {/if}
                              <span>{link.label}</span>
                            </button>
                          {/snippet}
                        </Sidebar.MenuButton>
                      </Sidebar.MenuItem>
                    {:else if link.items && link.items.length > 0}
                      {@const childActive = hasActiveChild(link)}
                      {@const ownActive = isActiveLink(link) && !childActive}
                      {@const active = showActiveState(ownActive)}
                      {@const onPath = showActiveState(
                        isAncestorLink(link) || childActive,
                      )}
                      {@const submenuOpen = submenuIsOpen(
                        link.id ?? link.href,
                        ownActive || childActive,
                        currentPathname,
                      )}
                      <Sidebar.MenuItem>
                        <Sidebar.MenuButton
                          isActive={active}
                          class={cn(onPath && "bg-sidebar-accent/50 font-medium", link.discoveryHint && "h-auto min-h-11 py-1.5 md:min-h-8 [&>span:last-child]:whitespace-normal! [&>span:last-child]:[overflow-wrap:anywhere] transition-[width,height]", link.discoveryHint && (link.badge != null ? "pe-28!" : "pe-16!"))}
                          data-shell-ancestor={onPath ? "true" : undefined}
                          tooltipContent={!sidebar.isMobile && sidebar.state === "collapsed" ? link.label : undefined}
                        >
                          {#snippet child({ props })}
                            <a
                              {...props}
                              href={link.href}
                              use:revealCurrent={active}
                              aria-label={link.ariaLabel}
                              aria-describedby={link.discoveryHint ? hintId(link, mobile) : undefined}
                              aria-current={active
                                ? "page"
                                : onPath
                                  ? "location"
                                  : undefined}
                              onclick={closeMobileSidebar}
                            >
                              {#if link.glyph}
                                <SettingsGlyph name={link.glyph} />
                              {:else if link.icon}
                                {@const Icon = link.icon}
                                <Icon />
                              {/if}
                              <span class={cn("font-medium", link.discoveryHint && "min-w-0 flex-1")}>{link.label}</span>
                            </a>
                          {/snippet}
                        </Sidebar.MenuButton>
                        <Sidebar.MenuAction
                          aria-expanded={submenuOpen}
                          aria-label={link.label}
                          class={cn(
                            // WCAG 2.2 SC 2.5.8 needs 24x24; the chevron stays 16px.
                            "top-1 w-6 peer-data-[size=default]/menu-button:top-1",
                            link.discoveryHint ? "right-1" : link.badge != null && link.badge > 0 && "right-8",
                          )}
                          onclick={(event) => {
                            event.preventDefault();
                            setSubmenuOpen(
                              link.id ?? link.href,
                              currentPathname,
                              !submenuOpen,
                            );
                          }}
                        >
                          <ChevronRightIcon
                            class={submenuOpen ? "rotate-90" : undefined}
                          />
                        </Sidebar.MenuAction>
                        {#if link.discoveryHint}
                          {@render navigationHint(link, mobile, Boolean(link.items?.length))}
                        {:else if link.badge != null && link.badge > 0}
                          <Sidebar.MenuBadge>{link.badge}</Sidebar.MenuBadge>
                        {/if}

                        {#if submenuOpen}
                          <Sidebar.MenuSub>
                            {#each link.items as subLink}
                              {@const nestedActive = hasActiveChild(subLink)}
                              {@const subOwnActive =
                                isActiveLink(subLink) && !nestedActive}
                              {@const subActive =
                                showActiveState(subOwnActive)}
                              <Sidebar.MenuSubItem>
                                <Sidebar.MenuSubButton isActive={subActive} class={cn("h-auto min-h-7 py-1 [&>span:last-child]:whitespace-normal [&>span:last-child]:break-words", nestedActive && "bg-sidebar-accent/50 font-medium")} data-shell-ancestor={nestedActive ? "true" : undefined}>
                                  {#snippet child({ props })}
                                    {#if subLink.disabledReason}
                                      <button
                                        {...props}
                                        aria-describedby="demo-unavailable"
                                        title={subLink.disabledReason}
                                        disabled
                                        type="button"
                                      >
                                        <span>{subLink.label}</span>
                                      </button>
                                    {:else}
                                    <a
                                      {...props}
                                      href={subLink.href}
                                      use:revealCurrent={subActive}
                                      aria-label={subLink.ariaLabel}
                                      aria-current={subActive
                                        ? "page"
                                        : nestedActive
                                          ? "location"
                                          : undefined}
                                      onclick={closeMobileSidebar}
                                    >
                                      <span>{subLink.label}</span>
                                      {@render badge(subLink.badge)}
                                    </a>
                                    {/if}
                                  {/snippet}
                                </Sidebar.MenuSubButton>

                                {#if subOwnActive || nestedActive}
                                  {#if subLink.items && subLink.items.length > 0}
                                    <Sidebar.MenuSub>
                                      {#each subLink.items as nested}
                                        {@const nestedItemActive =
                                          showActiveState(isActiveLink(nested))}
                                        <Sidebar.MenuSubItem>
                                          <Sidebar.MenuSubButton
                                            isActive={nestedItemActive}
                                            class="h-auto min-h-7 py-1 [&>span:last-child]:whitespace-normal [&>span:last-child]:break-words"
                                          >
                                            {#snippet child({ props })}
                                              <a
                                                {...props}
                                                href={nested.href}
                                                use:revealCurrent={nestedItemActive}
                                                aria-label={nested.ariaLabel}
                                                aria-current={nestedItemActive
                                                  ? "page"
                                                  : undefined}
                                                onclick={closeMobileSidebar}
                                              >
                                                <span>{nested.label}</span>
                                              </a>
                                            {/snippet}
                                          </Sidebar.MenuSubButton>
                                        </Sidebar.MenuSubItem>
                                      {/each}
                                    </Sidebar.MenuSub>
                                  {/if}
                                {/if}
                              </Sidebar.MenuSubItem>
                            {/each}
                          </Sidebar.MenuSub>
                        {/if}
                      </Sidebar.MenuItem>
                    {:else}
                      {@const active = showActiveState(isActiveLink(link))}
                      {@const onPath = showActiveState(isAncestorLink(link))}
                      <Sidebar.MenuItem>
                        <Sidebar.MenuButton
                          isActive={active}
                          class={cn(onPath && "bg-sidebar-accent/50 font-medium", link.discoveryHint && "h-auto min-h-11 py-1.5 md:min-h-8 [&>span:last-child]:whitespace-normal! [&>span:last-child]:[overflow-wrap:anywhere] transition-[width,height]", link.discoveryHint && (link.badge != null ? "pe-28!" : "pe-16!"))}
                          data-shell-ancestor={onPath ? "true" : undefined}
                          tooltipContent={!sidebar.isMobile && sidebar.state === "collapsed" ? link.label : undefined}
                        >
                          {#snippet child({ props })}
                            <a
                              {...props}
                              href={link.href}
                              use:revealCurrent={active}
                              aria-label={link.ariaLabel}
                              aria-describedby={link.discoveryHint ? hintId(link, mobile) : undefined}
                              aria-current={active
                                ? "page"
                                : onPath
                                  ? "location"
                                  : undefined}
                              onclick={closeMobileSidebar}
                            >
                              {#if link.glyph}
                                <SettingsGlyph name={link.glyph} />
                              {:else if link.icon}
                                {@const Icon = link.icon}
                                <Icon />
                              {/if}
                              <span class={cn("font-medium", link.discoveryHint && "min-w-0 flex-1")}>{link.label}</span>
                            </a>
                          {/snippet}
                        </Sidebar.MenuButton>
                        {#if link.discoveryHint}
                          {@render navigationHint(link, mobile, Boolean(link.items?.length))}
                        {:else if link.badge != null && link.badge > 0}
                          <Sidebar.MenuBadge>{link.badge}</Sidebar.MenuBadge>
                        {/if}
                      </Sidebar.MenuItem>
                    {/if}
                  {/each}
                </Sidebar.Menu>
              </Sidebar.GroupContent>
            </Collapsible.Content>
          </Sidebar.Group>
        </Collapsible.Root>
      {/each}
      </div>
    </Sidebar.Content>
  </nav>
{/snippet}

<Sidebar.Root
  mobileTitle={sectionSidebar?.navLabel ?? copy.shell.primaryNavigation}
  mobileDescription={copy.shell.menu}
  closeLabel={copy.shell.closeNavigation}
  class={dockAboveFooter && !sidebar.isMobile
    ? "top-0! bottom-16! h-auto! max-h-none!"
    : undefined}
  collapsible="icon"
  data-testid="app-sidebar"
>
  {#if sidebar.isMobile}
    {@render navigation(navGroups, true)}
  {:else}
    {@render navigation(navGroups, false)}
    <Sidebar.Rail label={copy.shell.toggleSidebar} />
  {/if}

  {#if showAccountFooter || sidebar.isMobile || footerLinks.length > 0}
    <Sidebar.Footer class="justify-center gap-2 border-t p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] md:pb-2">
      {#if footerLinks.length > 0}
        <nav
          aria-label={copy.shell.footerNavigation}
          class="flex min-w-0 flex-wrap gap-x-3 gap-y-1 px-2 text-muted-foreground text-xs group-data-[collapsible=icon]:hidden"
          data-shell-legal-nav
        >
          {#each footerLinks as link}
            <a
              class="py-1.5 transition-colors hover:text-foreground"
              href={link.href}
              rel={link.rel}
              target={link.target}
              onclick={closeMobileSidebar}
            >
              {link.label}
            </a>
          {/each}
        </nav>
      {/if}
      {#if viewerLoading}
        <div
          aria-hidden="true"
          class="flex h-12 items-center gap-2 px-2"
          data-testid="sidebar-viewer-loading"
        >
          <Skeleton class="size-8 rounded-lg bg-sidebar-accent" />
          <div class="grid flex-1 gap-1 group-data-[collapsible=icon]:hidden">
            <Skeleton class="h-3 w-24 rounded bg-sidebar-accent" />
            <Skeleton class="h-2.5 w-16 rounded bg-sidebar-accent" />
          </div>
        </div>
      {:else}
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
    </Sidebar.Footer>
  {/if}
</Sidebar.Root>
