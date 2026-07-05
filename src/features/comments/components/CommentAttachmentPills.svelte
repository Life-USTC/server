<script lang="ts">
import XIcon from "@lucide/svelte/icons/x";
import { Badge } from "$lib/components/ui/badge/index.js";
import { Button } from "$lib/components/ui/button/index.js";

type AttachmentOption = {
  filename: string;
  id: string;
};

export let className = "";
export let files: AttachmentOption[] = [];
export let onRemove: (id: string) => void;
export let removeLabel: string;
</script>

{#if files.length > 0}
  <div class={className || "flex flex-wrap gap-2"}>
    {#each files as file}
      <Badge class="gap-1 pr-1" variant="outline">
        <span class="max-w-40 truncate">{file.filename}</span>
        <Button
          aria-label={removeLabel}
          size="icon-xs"
          type="button"
          variant="ghost"
          onclick={() => onRemove(file.id)}
        >
          <XIcon data-icon="inline-start" />
        </Button>
      </Badge>
    {/each}
  </div>
{/if}
