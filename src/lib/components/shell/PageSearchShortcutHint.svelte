<script lang="ts">
import {
  isApplePlatform,
  pageSearchShortcutKeys,
} from "@/lib/browser/page-search-shortcut";
import { browser } from "$app/environment";
import * as Kbd from "$lib/components/ui/kbd/index.js";

$: keys = pageSearchShortcutKeys(browser && isApplePlatform());
</script>

<Kbd.Group>
  {#each keys as key}
    <Kbd.Root>{key}</Kbd.Root>
  {/each}
</Kbd.Group>
