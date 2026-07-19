<script lang="ts">
import ChevronDownIcon from "@lucide/svelte/icons/chevron-down";
import appIconUrl from "$lib/assets/life-ustc-icon-192.png";
import type { ThemeMode } from "$lib/components/shell/layout-shell";
import * as Collapsible from "$lib/components/ui/collapsible/index.js";
import * as Sidebar from "$lib/components/ui/sidebar/index.js";
import type { LayoutCopy } from "$lib/shell/layout-server-data";
import AppPreferencesMenu from "./AppPreferencesMenu.svelte";
import type { ShellLink, ShellNavGroup } from "./types";

let {
  copy,
  isActiveLink,
  locale,
  localeMenuOpen,
  mobileNavGroups,
  navGroups,
  setLocale,
  setLocaleMenuOpen,
  setThemeMenuOpen,
  setThemeMode,
  themeMenuOpen,
  themeMode,
}: {
  copy: LayoutCopy;
  isActiveLink: (link: ShellLink) => boolean;
  locale: "en-us" | "zh-cn";
  localeMenuOpen: boolean;
  mobileNavGroups: ShellNavGroup[];
  navGroups: ShellNavGroup[];
  setLocale: (locale: "en-us" | "zh-cn") => void;
  setLocaleMenuOpen: (open: boolean) => void;
  setThemeMenuOpen: (open: boolean) => void;
  setThemeMode: (mode: ThemeMode) => void;
  themeMenuOpen: boolean;
  themeMode: ThemeMode;
} = $props();

// biome-ignore lint/correctness/useHookAtTopLevel: useSidebar is a Svelte context helper, not a React hook
const sidebar = Sidebar.useSidebar();
const groupOpen = $state<Record<string, boolean>>({});

function hasActiveChild(link: ShellLink): boolean {
  return (
    link.items?.some((child) => isActiveLink(child) || hasActiveChild(child)) ??
    false
  );
}

function setGroupOpen(key: string, isOpen: boolean): void {
  groupOpen[key] = isOpen;
}

function showActiveState(active: boolean): boolean {
  return active && (!sidebar.isMobile || sidebar.openMobile);
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

{#snippet navigation(groups: ShellNavGroup[], mobile: boolean)}
  <nav
    aria-label={mobile
      ? copy.shell.secondaryNavigation
      : copy.shell.primaryNavigation}
    data-shell-navigation={mobile ? "secondary" : "desktop"}
    class="flex min-h-0 flex-1 flex-col"
  >
    <Sidebar.Header>
      <Sidebar.Menu>
        <Sidebar.MenuItem>
          <Sidebar.MenuButton tooltipContent="Life@USTC">
            {#snippet child({ props })}
              <a
                {...props}
                id="app-logo"
                href="/"
                aria-label="Life@USTC"
                onclick={closeMobileSidebar}
              >
                <img
                  class="size-6 rounded-md"
                  src={appIconUrl}
                  alt=""
                  aria-hidden="true"
                />
                <span>Life@USTC</span>
              </a>
            {/snippet}
          </Sidebar.MenuButton>
        </Sidebar.MenuItem>
      </Sidebar.Menu>
    </Sidebar.Header>

    <Sidebar.Content>
      {#each groups as group, index}
        {@const isCollapsed = !mobile && sidebar.state === "collapsed"}
        {@const groupKey = `${mobile ? "mobile" : "desktop"}-${index}`}
        {@const groupActive = group.links.some(
          (link) => isActiveLink(link) || hasActiveChild(link),
        )}
        {@const isOpen =
          isCollapsed ||
          groupActive ||
          (groupOpen[groupKey] ?? Boolean(group.defaultOpen))}
        <Collapsible.Root
          open={isOpen}
          onOpenChange={(value) => {
            if (!isCollapsed) setGroupOpen(groupKey, value);
          }}
          class="group/collapsible"
        >
          <Sidebar.Group>
            <Sidebar.GroupLabel>
              {#snippet child({ props })}
                <Collapsible.Trigger {...props} disabled={isCollapsed}>
                  {group.label}
                  <ChevronDownIcon
                    class="ms-auto transition-transform group-data-[state=open]/collapsible:rotate-180"
                  />
                </Collapsible.Trigger>
              {/snippet}
            </Sidebar.GroupLabel>
            <Collapsible.Content>
              <Sidebar.GroupContent>
                <Sidebar.Menu>
                  {#each group.links as link}
                    {#if link.items && link.items.length > 0}
                      {@const childActive = hasActiveChild(link)}
                      {@const ownActive = isActiveLink(link) && !childActive}
                      {@const active = showActiveState(ownActive)}
                      <Sidebar.MenuItem>
                        <Sidebar.MenuButton
                          isActive={active}
                          tooltipContent={link.label}
                        >
                          {#snippet child({ props })}
                            <a
                              {...props}
                              href={link.href}
                              aria-label={link.ariaLabel}
                              aria-current={active ? "page" : undefined}
                              onclick={closeMobileSidebar}
                            >
                              {#if link.icon}
                                {@const Icon = link.icon}
                                <Icon />
                              {/if}
                              <span>{link.label}</span>
                              {@render badge(link.badge)}
                            </a>
                          {/snippet}
                        </Sidebar.MenuButton>

                        {#if ownActive || childActive}
                          <Sidebar.MenuSub>
                            {#each link.items as subLink}
                              {@const nestedActive = hasActiveChild(subLink)}
                              {@const subOwnActive =
                                isActiveLink(subLink) && !nestedActive}
                              {@const subActive =
                                showActiveState(subOwnActive)}
                              <Sidebar.MenuSubItem>
                                <Sidebar.MenuSubButton isActive={subActive}>
                                  {#snippet child({ props })}
                                    <a
                                      {...props}
                                      href={subLink.href}
                                      aria-label={subLink.ariaLabel}
                                      aria-current={subActive
                                        ? "page"
                                        : undefined}
                                      onclick={closeMobileSidebar}
                                    >
                                      <span>{subLink.label}</span>
                                      {@render badge(subLink.badge)}
                                    </a>
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
                                          >
                                            {#snippet child({ props })}
                                              <a
                                                {...props}
                                                href={nested.href}
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
                      <Sidebar.MenuItem>
                        <Sidebar.MenuButton
                          isActive={active}
                          tooltipContent={link.label}
                        >
                          {#snippet child({ props })}
                            <a
                              {...props}
                              href={link.href}
                              aria-label={link.ariaLabel}
                              aria-current={active ? "page" : undefined}
                              onclick={closeMobileSidebar}
                            >
                              {#if link.icon}
                                {@const Icon = link.icon}
                                <Icon />
                              {/if}
                              <span>{link.label}</span>
                              {@render badge(link.badge)}
                            </a>
                          {/snippet}
                        </Sidebar.MenuButton>
                      </Sidebar.MenuItem>
                    {/if}
                  {/each}
                </Sidebar.Menu>
              </Sidebar.GroupContent>
            </Collapsible.Content>
          </Sidebar.Group>
        </Collapsible.Root>
      {/each}
    </Sidebar.Content>
  </nav>
{/snippet}

<Sidebar.Root collapsible="icon" data-testid="app-sidebar">
  {#if sidebar.isMobile}
    {@render navigation(mobileNavGroups, true)}
    <Sidebar.Footer class="border-t">
      <div class="text-muted-foreground px-1 text-xs font-medium">
        {copy.nav.groups.preferences}
      </div>
      <AppPreferencesMenu
        {copy}
        {locale}
        {localeMenuOpen}
        mobile
        {setLocale}
        {setLocaleMenuOpen}
        {setThemeMenuOpen}
        {setThemeMode}
        {themeMenuOpen}
        {themeMode}
      />
    </Sidebar.Footer>
  {:else}
    {@render navigation(navGroups, false)}
    <Sidebar.Rail />
  {/if}
</Sidebar.Root>
