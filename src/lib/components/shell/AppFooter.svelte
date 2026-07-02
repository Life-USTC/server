<script lang="ts">
import type { ShellCopy, ShellLink } from "./types";

export let copy: ShellCopy;
export let footerLinks: ShellLink[];
</script>

<footer class="border-base-300 border-t bg-base-100/80">
  <div
    class="mx-auto flex w-full max-w-7xl flex-col gap-3 px-4 py-4 text-base-content/60 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8"
  >
    <nav aria-label={copy.shell.primaryNavigation} class="flex flex-wrap items-center gap-x-5 gap-y-2">
      {#each footerLinks as link}
        <a
          class="transition-colors hover:text-base-content"
          href={link.href}
          rel={link.rel}
          target={link.target}
        >
          {link.label}
        </a>
      {/each}
    </nav>
    <p class="text-xs">Life@USTC</p>
  </div>
</footer>
