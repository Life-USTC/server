<script lang="ts">
import { primaryDestination } from "./navigation-scopes";
import type { ShellLink } from "./types";

let {
  links,
  pathname,
  label,
}: { links: ShellLink[]; pathname: string; label: string } = $props();
</script>

<nav
  aria-label={label}
  data-mobile-primary-navigation
  class="fixed inset-x-0 bottom-0 z-30 grid h-[calc(4rem+env(safe-area-inset-bottom))] grid-cols-4 border-t bg-background/95 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
>
  {#each links as link}
    {#if link.disabledReason}<button
        type="button"
        disabled
        title={link.disabledReason}
        class="flex min-h-0 min-w-0 flex-col items-center justify-center gap-1 text-xs text-muted-foreground"
        >{#if link.icon}{@const Icon = link.icon}<Icon
            class="size-5"
          />{/if}<span>{link.label}</span></button
      >
    {:else}<a
        href={link.href}
        aria-current={primaryDestination(pathname) === link.id
          ? pathname === link.href
            ? "page"
            : "location"
          : undefined}
        class="flex min-h-0 min-w-0 flex-col items-center justify-center gap-1 rounded-md text-xs text-muted-foreground aria-[current=page]:bg-accent aria-[current=page]:font-medium aria-[current=page]:text-accent-foreground aria-[current=location]:bg-accent aria-[current=location]:font-medium aria-[current=location]:text-accent-foreground"
        >{#if link.icon}{@const Icon = link.icon}<Icon
            class="size-5"
          />{/if}<span>{link.label}</span></a
      >{/if}
  {/each}
</nav>
