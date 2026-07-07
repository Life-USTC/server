<script lang="ts">
import ChevronDownIcon from "@lucide/svelte/icons/chevron-down";
import * as Collapsible from "$lib/components/ui/collapsible/index.js";
import * as Sidebar from "$lib/components/ui/sidebar/index.js";
import type { ShellCopy, ShellLink, ShellNavGroup } from "./types";

export let copy: ShellCopy;
export let isActiveLink: (link: ShellLink) => boolean;
export let navGroups: ShellNavGroup[];
</script>

<Sidebar.Root
  collapsible="icon"
  data-testid="app-sidebar"
  aria-label={copy.shell.primaryNavigation}
>
  <Sidebar.Header>
    <Sidebar.Menu>
      <Sidebar.MenuItem>
        <Sidebar.MenuButton
          tooltipContent="Life@USTC"
        >
          {#snippet child({ props })}
            <a {...props} id="app-logo" href="/" aria-label="Life@USTC">
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

  <Sidebar.Content>
    {#each navGroups as group}
      <Collapsible.Root open class="group/collapsible">
        <Sidebar.Group>
          <Sidebar.GroupLabel>
            {#snippet child({ props })}
              <Collapsible.Trigger {...props}>
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
                    {@const subActive = link.items.some((subLink) =>
                      isActiveLink(subLink),
                    )}
                    <Sidebar.MenuItem>
                      <Collapsible.Root
                        open={subActive}
                        class="group/collapsible"
                      >
                        <Sidebar.MenuButton
                          isActive={subActive}
                          tooltipContent={link.label}
                        >
                          {#snippet child({ props })}
                            <Collapsible.Trigger {...props}>
                              {#if link.icon}
                                <svelte:component this={link.icon} />
                              {/if}
                              <span>{link.label}</span>
                              <ChevronDownIcon
                                class="ms-auto transition-transform group-data-[state=open]/collapsible:rotate-180"
                              />
                            </Collapsible.Trigger>
                          {/snippet}
                        </Sidebar.MenuButton>
                        <Collapsible.Content>
                          <Sidebar.MenuSub>
                            {#each link.items as subLink}
                              {@const active = isActiveLink(subLink)}
                              <Sidebar.MenuSubItem>
                                <Sidebar.MenuSubButton isActive={active}>
                                  {#snippet child({ props })}
                                    <a
                                      {...props}
                                      href={subLink.href}
                                      aria-label={subLink.ariaLabel}
                                      aria-current={active ? "page" : undefined}
                                    >
                                      <span>{subLink.label}</span>
                                    </a>
                                  {/snippet}
                                </Sidebar.MenuSubButton>
                              </Sidebar.MenuSubItem>
                            {/each}
                          </Sidebar.MenuSub>
                        </Collapsible.Content>
                      </Collapsible.Root>
                    </Sidebar.MenuItem>
                  {:else}
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
                  {/if}
                {/each}
              </Sidebar.Menu>
            </Sidebar.GroupContent>
          </Collapsible.Content>
        </Sidebar.Group>
      </Collapsible.Root>
    {/each}
  </Sidebar.Content>

  <Sidebar.Rail />
</Sidebar.Root>
