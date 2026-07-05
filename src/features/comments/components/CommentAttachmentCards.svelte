<script lang="ts">
import { Button } from "$lib/components/ui/button/index.js";
import * as Item from "$lib/components/ui/item/index.js";

type CommentAttachment = {
  filename: string;
  size?: number;
  uploadId: string;
};

export let attachments: CommentAttachment[] = [];
export let formatSize: (value: number | undefined) => string;
export let openLabel: string;
</script>

{#if attachments.length > 0}
  <Item.Group class="grid gap-2 sm:grid-cols-2">
    {#each attachments as attachment}
      <Item.Root class="items-start" size="sm" variant="outline">
        <Item.Content class="min-w-0">
          <Item.Title>{attachment.filename}</Item.Title>
          <Item.Description>{formatSize(attachment.size)}</Item.Description>
        </Item.Content>
        <Item.Actions>
          <Button
            class="w-fit"
            href={`/api/uploads/${attachment.uploadId}/download?preview=1`}
            size="sm"
            target="_blank"
            variant="outline"
          >
            {openLabel}
          </Button>
        </Item.Actions>
      </Item.Root>
    {/each}
  </Item.Group>
{/if}
