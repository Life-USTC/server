<script lang="ts">
import * as Kbd from "#lib/components/ui/kbd/index.js";
import {
  isApplePlatform,
  pageSearchShortcutKeys,
} from "@/lib/browser/page-search-shortcut";
import { browser } from "$app/env";

$: keys = pageSearchShortcutKeys(browser && isApplePlatform());
</script>

<Kbd.Group class="hidden sm:inline-flex">
  {#each keys as key}
    <Kbd.Root>{key}</Kbd.Root>
  {/each}
</Kbd.Group>
