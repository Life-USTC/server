<script lang="ts">
import { Button } from "$lib/components/ui/button/index.js";
import * as Card from "$lib/components/ui/card/index.js";

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
  <div class="grid gap-2 sm:grid-cols-2">
    {#each attachments as attachment}
      <Card.Root class="border-base-300 bg-base-100 shadow-none">
        <Card.Content class="grid gap-2 p-3">
          <div class="min-w-0">
            <p class="truncate font-medium text-sm">{attachment.filename}</p>
            <p class="mt-1 text-base-content/60 text-xs">{formatSize(attachment.size)}</p>
          </div>
          <Button
            class="w-fit"
            href={`/api/uploads/${attachment.uploadId}/download?preview=1`}
            size="sm"
            target="_blank"
            variant="outline"
          >
            {openLabel}
          </Button>
        </Card.Content>
      </Card.Root>
    {/each}
  </div>
{/if}
