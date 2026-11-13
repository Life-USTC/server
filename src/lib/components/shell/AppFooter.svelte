<script lang="ts">
import type { LayoutCopy } from "#lib/shell/layout-server-data.js";
import type { ShellLink } from "./types";

let { copy, footerLinks }: { copy: LayoutCopy; footerLinks: ShellLink[] } =
  $props();
</script>

<footer
  class="border-border relative z-20 flex min-h-16 w-full shrink-0 items-stretch border-t bg-muted/40 md:h-16 md:pb-0"
>
  <div
    class="flex min-w-0 flex-1 items-center justify-between gap-4 bg-transparent px-4 text-foreground/90 text-sm sm:px-5 lg:px-6"
  >
    <nav
      aria-label={copy.shell.footerNavigation}
      class="flex min-w-0 flex-wrap items-center gap-x-5 gap-y-1"
    >
      {#each footerLinks as link}
        <a
          class="py-1 text-foreground/90 underline-offset-4 transition-colors hover:text-foreground hover:underline"
          href={link.href}
          rel={link.rel}
          target={link.target}
        >
          {link.label}
        </a>
      {/each}
    </nav>
    <p class="sr-only shrink-0 text-foreground/80 text-xs sm:not-sr-only">
      Life@USTC
    </p>
  </div>
</footer>
