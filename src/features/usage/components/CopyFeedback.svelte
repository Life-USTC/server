<script lang="ts">
import CheckIcon from "@lucide/svelte/icons/check";
import CopyIcon from "@lucide/svelte/icons/copy";

let {
  copied,
  label,
  copiedLabel,
}: {
  copied: boolean;
  label: string | undefined;
  copiedLabel: string | undefined;
} = $props();
</script>

<span class="flex shrink-0 items-center gap-1.5 text-muted-foreground text-xs group-hover:text-foreground">
  {#if copied}
    <CheckIcon data-icon="inline-end" />
  {:else}
    <CopyIcon data-icon="inline-end" />
  {/if}
  <span class="sr-only sm:not-sr-only">{copied ? copiedLabel : label}</span>
</span>
