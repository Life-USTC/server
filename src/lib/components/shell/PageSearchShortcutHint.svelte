<script lang="ts">
import { onMount } from "svelte";
import * as Kbd from "#lib/components/ui/kbd/index.js";
import { pageSearchShortcutKeys } from "@/lib/browser/page-search-shortcut";

let keys = pageSearchShortcutKeys(false);
onMount(() => {
  keys = pageSearchShortcutKeys();
});
</script>

<Kbd.Group class="hidden sm:inline-flex">
  {#each keys as key}
    <Kbd.Root>{key}</Kbd.Root>
  {/each}
</Kbd.Group>
