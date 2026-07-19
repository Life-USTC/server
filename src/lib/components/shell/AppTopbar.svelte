<script lang="ts">
import appIconUrl from "$lib/assets/life-ustc-icon-192.png";
import { Button } from "$lib/components/ui/button/index.js";
import * as Sidebar from "$lib/components/ui/sidebar/index.js";
import type {
  LayoutCopy,
  LayoutUserSummary,
} from "$lib/shell/layout-server-data";

export let closeMenus: () => void;
export let copy: LayoutCopy;
export let user: LayoutUserSummary;
</script>

<header
  data-shell-topbar
  class="bg-card/95 sticky top-0 z-20 h-14 shrink-0 border-b backdrop-blur md:h-12"
>
  <div class="flex h-full items-center gap-2 px-3 sm:px-5 lg:px-6">
    <Sidebar.Trigger
      aria-label={copy.shell.menu}
      class="size-11 md:size-7"
      onclick={closeMenus}
    />

    <a
      class="inline-flex min-h-11 min-w-0 items-center gap-2 rounded-md font-semibold leading-none transition-opacity hover:opacity-75 lg:hidden"
      href="/"
    >
      <img
        class="size-7 rounded-md"
        src={appIconUrl}
        alt=""
        aria-hidden="true"
      />
      <span class="truncate">Life@USTC</span>
    </a>

    {#if !user}
      <Button class="ml-auto" href="/signin" size="sm">
        {copy.menu.signIn}
      </Button>
    {/if}
  </div>
</header>
