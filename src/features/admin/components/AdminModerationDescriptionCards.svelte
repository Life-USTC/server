<script lang="ts">
import * as Item from "$lib/components/ui/item/index.js";
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

<Item.Group class="md:hidden">
  {#each descriptions as description}
    <Item.Root variant="outline" class="items-start">
      {#snippet child({ props })}
        <button {...props} type="button" onclick={() => onManage(description)}>
          <Item.Content class="min-w-0 gap-2">
            <Item.Title class="line-clamp-none">{targetLabel(description)}</Item.Title>
            <Item.Description>
              {formatDate(adminModerationDescriptionEditedAt(description))}
            </Item.Description>
            <Item.Description class="line-clamp-4 whitespace-pre-wrap">
              {description.content || copy.emptyDescription}
            </Item.Description>
            <Item.Description>
              {formatMessage(copy.lastEditor, {
                name: adminModerationDescriptionLastEditor(description, copy),
              })}
            </Item.Description>
          </Item.Content>
        </button>
      {/snippet}
    </Item.Root>
  {/each}
</Item.Group>
