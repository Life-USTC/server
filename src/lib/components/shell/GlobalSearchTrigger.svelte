<script lang="ts">
import SearchIcon from "@lucide/svelte/icons/search";
import { toolbarFieldClass } from "#lib/components/toolbar-control.js";
import { Button } from "#lib/components/ui/button/index.js";
import * as Kbd from "#lib/components/ui/kbd/index.js";
import type { LayoutCopy } from "#lib/shell/layout-server-data.js";

export let copy: LayoutCopy["globalSearch"];
export let onOpen: () => void;
export let shortcutLabel: string;
export let signedIn = false;
export let variant: "desktop" | "mobile" = "desktop";

$: placeholder = signedIn ? copy.placeholderSignedIn : copy.placeholder;
</script>

{#if variant === "desktop"}
  <Button
    class="{toolbarFieldClass} w-full max-w-sm justify-start gap-2 px-3 text-muted-foreground lg:max-w-md"
    onclick={onOpen}
    variant="outline"
  >
    <span class="sr-only">{copy.openSearch}</span>
    <SearchIcon data-icon="inline-start" class="shrink-0" />
    <span class="truncate">{placeholder}</span>
    <span class="ml-auto hidden items-center gap-1 sm:inline-flex">
      <Kbd.Root>{shortcutLabel}</Kbd.Root>
    </span>
  </Button>
{:else}
  <Button
    icon={SearchIcon}
    aria-label={copy.openSearch}
    class="icon-action"
    size="icon"
    onclick={onOpen}
    variant="ghost"
  />
{/if}
