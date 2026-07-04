<script lang="ts">
import { Button } from "$lib/components/ui/button/index.js";
import {
  adminModerationDescriptionEditedAt,
  adminModerationDescriptionLastEditor,
} from "./admin-moderation-description-display";
import type {
  AdminModerationDescription,
  AdminModerationDescriptionCopy,
} from "./admin-moderation-description-types";

export let copy: AdminModerationDescriptionCopy;
export let descriptions: AdminModerationDescription[];
export let formatDate: (value: string | Date) => string;
export let formatMessage: (
  template: string,
  values: Record<string, string>,
) => string;
export let onManage: (description: AdminModerationDescription) => void;
export let targetLabel: (description: AdminModerationDescription) => string;
</script>

<div class="grid gap-3 md:hidden">
  {#each descriptions as description}
    <Button
      class="h-auto w-full justify-start p-0 text-left whitespace-normal"
      variant="outline"
      type="button"
      onclick={() => onManage(description)}
    >
      <span class="grid w-full gap-3 p-4">
        <span class="flex flex-wrap items-center justify-between gap-2">
          <span class="font-semibold text-lg">{targetLabel(description)}</span>
          <span class="text-muted-foreground text-sm">
            {formatDate(adminModerationDescriptionEditedAt(description))}
          </span>
        </span>
        <span class="line-clamp-4 whitespace-pre-wrap text-sm">
          {description.content || copy.emptyDescription}
        </span>
        <span class="text-muted-foreground text-xs">
          {formatMessage(copy.lastEditor, {
            name: adminModerationDescriptionLastEditor(description, copy),
          })}
        </span>
      </span>
    </Button>
  {/each}
</div>
