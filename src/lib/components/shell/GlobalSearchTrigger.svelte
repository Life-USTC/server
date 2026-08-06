<script lang="ts">
import SearchIcon from "@lucide/svelte/icons/search";
import { Button } from "$lib/components/ui/button/index.js";
import * as Kbd from "$lib/components/ui/kbd/index.js";
import type { LayoutCopy } from "$lib/shell/layout-server-data";

export let copy: LayoutCopy["globalSearch"];
export let onOpen: () => void;
export let shortcutLabel: string;
export let signedIn = false;
export let variant: "desktop" | "mobile" = "desktop";

$: placeholder = signedIn ? copy.placeholderSignedIn : copy.placeholder;
</script>

{#if variant === "desktop"}
  <Button
    aria-label={copy.openSearch}
    class="h-8 w-full max-w-sm justify-start gap-2 px-3 text-muted-foreground lg:max-w-md"
    onclick={onOpen}
    type="button"
    variant="outline"
  >
    <SearchIcon class="size-4 shrink-0" />
    <span class="truncate">{placeholder}</span>
    <span class="ml-auto hidden items-center gap-1 sm:inline-flex">
      <Kbd.Root>{shortcutLabel}</Kbd.Root>
    </span>
  </Button>
{:else}
  <Button
    aria-label={copy.openSearch}
    class="size-11"
    onclick={onOpen}
    type="button"
    variant="ghost"
  >
    <SearchIcon class="size-5" />
  </Button>
{/if}
