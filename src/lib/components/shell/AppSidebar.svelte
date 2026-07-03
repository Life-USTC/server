<script lang="ts">
import * as Sidebar from "$lib/components/ui/sidebar/index.js";
import type { ShellCopy, ShellLink, ShellNavGroup } from "./types";

export let copy: ShellCopy;
export let isActiveLink: (link: ShellLink) => boolean;
export let navGroups: ShellNavGroup[];
</script>

<Sidebar.Root
  collapsible="icon"
  desktopBreakpoint="lg"
  hoverPreview
  mobileMode="sheet"
  position="static"
  class="border-sidebar-border bg-sidebar"
  data-testid="app-sidebar"
>
  <Sidebar.Header class="h-12 justify-center border-sidebar-border border-b">
    <Sidebar.Menu>
      <Sidebar.MenuItem>
        <Sidebar.MenuButton class="font-semibold" tooltipContent="Life@USTC">
          {#snippet child({ props })}
            <a {...props} href="/" aria-label="Life@USTC">
              <img
                class="size-6 rounded-md"
                src="/images/icon.png"
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

  <Sidebar.Content class="p-2" aria-label={copy.shell.primaryNavigation}>
    {#each navGroups as group}
      <Sidebar.Group class="p-0">
        <Sidebar.GroupLabel>{group.label}</Sidebar.GroupLabel>
        <Sidebar.GroupContent>
          <Sidebar.Menu>
            {#each group.links as link}
              {@const active = isActiveLink(link)}
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
                    >
                      {#if link.icon}
                        <svelte:component this={link.icon} />
                      {/if}
                      <span>{link.label}</span>
                    </a>
                  {/snippet}
                </Sidebar.MenuButton>
              </Sidebar.MenuItem>
            {/each}
          </Sidebar.Menu>
        </Sidebar.GroupContent>
      </Sidebar.Group>
    {/each}
  </Sidebar.Content>

  <Sidebar.Footer class="pointer-events-none border-sidebar-border border-t group-data-[collapsible=icon]:items-center">
    <Sidebar.Trigger
      class="pointer-events-auto self-end group-data-[collapsible=icon]:self-center"
      aria-label="Toggle sidebar"
      title="Toggle sidebar"
    />
  </Sidebar.Footer>
</Sidebar.Root>
