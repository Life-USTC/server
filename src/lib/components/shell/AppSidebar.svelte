<script lang="ts">
import ChevronDownIcon from "@lucide/svelte/icons/chevron-down";
import * as Collapsible from "$lib/components/ui/collapsible/index.js";
import * as Sidebar from "$lib/components/ui/sidebar/index.js";
import type { ShellCopy, ShellLink, ShellNavGroup } from "./types";

export let copy: ShellCopy;
export let isActiveLink: (link: ShellLink) => boolean;
export let navGroups: ShellNavGroup[];

function hasActiveChild(link: ShellLink): boolean {
  return (
    link.items?.some((child) => isActiveLink(child) || hasActiveChild(child)) ??
    false
  );
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
                      isActiveLink(subLink) || hasActiveChild(subLink),
                    )}
                    <Sidebar.MenuItem>
                      <Collapsible.Root
                        open={isActiveLink(link) || subActive}
                        class="group/collapsible"
                      >
                        <div class="flex w-full items-center">
                          <Sidebar.MenuButton
                            isActive={subActive}
                            tooltipContent={link.label}
                            class="flex-1"
                          >
                            {#snippet child({ props })}
                              <a
                                {...props}
                                href={link.href}
                                aria-label={link.ariaLabel}
                                aria-current={isActiveLink(link) ? "page" : undefined}
                              >
                                {#if link.icon}
                                  <svelte:component this={link.icon} />
                                {/if}
                                <span>{link.label}</span>
                                {#if link.badge != null && link.badge > 0}
                                  {@render badge(link.badge)}
                                {/if}
                              </a>
                            {/snippet}
                          </Sidebar.MenuButton>
                          <Collapsible.Trigger
                            class="text-sidebar-foreground ring-sidebar-ring hover:bg-sidebar-accent hover:text-sidebar-accent-foreground flex h-8 w-8 shrink-0 items-center justify-center rounded-md outline-hidden transition-transform focus-visible:ring-2 [&>svg]:size-4 [&>svg]:shrink-0 group-data-[collapsible=icon]:hidden"
                            aria-label={`Toggle ${link.label}`}
                          >
                            <ChevronDownIcon
                              class="transition-transform group-data-[state=open]/collapsible:rotate-180"
                            />
                          </Collapsible.Trigger>
                        </div>
                        <Collapsible.Content>
                          <Sidebar.MenuSub>
                            {#each link.items as subLink}
                              {@const active = isActiveLink(subLink)}
                              {#if subLink.items && subLink.items.length > 0}
                                {@const nestedActive = subLink.items.some((nested) => isActiveLink(nested))}
                                <Sidebar.MenuSubItem>
                                  <Collapsible.Root open={active || nestedActive} class="group/collapsible">
                                    <Sidebar.MenuSubButton isActive={active || nestedActive}>
                                      {#snippet child({ props })}
                                        <Collapsible.Trigger {...props}>
                                          <span>{subLink.label}</span>
                                          {@render badge(subLink.badge)}
                                          <ChevronDownIcon
                                            class="ms-auto transition-transform group-data-[state=open]/collapsible:rotate-180"
                                          />
                                        </Collapsible.Trigger>
                                      {/snippet}
                                    </Sidebar.MenuSubButton>
                                    <Collapsible.Content>
                                      <Sidebar.MenuSub>
                                        {#each subLink.items as nested}
                                          {@const nestedItemActive = isActiveLink(nested)}
                                          <Sidebar.MenuSubItem>
                                            <Sidebar.MenuSubButton isActive={nestedItemActive}>
                                              {#snippet child({ props })}
                                                <a
                                                  {...props}
                                                  href={nested.href}
                                                  aria-label={nested.ariaLabel}
                                                  aria-current={nestedItemActive ? "page" : undefined}
                                                >
                                                  <span>{nested.label}</span>
                                                </a>
                                              {/snippet}
                                            </Sidebar.MenuSubButton>
                                          </Sidebar.MenuSubItem>
                                        {/each}
                                      </Sidebar.MenuSub>
                                    </Collapsible.Content>
                                  </Collapsible.Root>
                                </Sidebar.MenuSubItem>
                              {:else}
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
                                        {@render badge(subLink.badge)}
                                      </a>
                                    {/snippet}
                                  </Sidebar.MenuSubButton>
                                </Sidebar.MenuSubItem>
                              {/if}
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
