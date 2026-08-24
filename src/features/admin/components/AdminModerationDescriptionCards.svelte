<script lang="ts">
import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";
import { Button } from "$lib/components/ui/button/index.js";
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
export let manageLabel: string;
export let onManage: (description: AdminModerationDescription) => void;
export let targetLabel: (description: AdminModerationDescription) => string;
</script>

<Item.Group class="xl:hidden gap-0 border-y">
  {#each descriptions as description, index (description.id)}
    <Item.Root class="items-start px-1 py-3">
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
      <Item.Actions class="shrink-0 self-start">
        <Button
          aria-label={manageLabel}
          onclick={() => onManage(description)}
          size="sm"
          type="button"
          variant="ghost"
        >
          {manageLabel}
          <ChevronRightIcon aria-hidden="true" data-icon="inline-end" />
        </Button>
      </Item.Actions>
    </Item.Root>
    {#if index < descriptions.length - 1}<Item.Separator class="my-0" />{/if}
  {/each}
</Item.Group>
