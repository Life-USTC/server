<script lang="ts">
import { Button } from "$lib/components/ui/button/index.js";
import * as Item from "$lib/components/ui/item/index.js";
import type { AdminModerationDescription } from "./admin-moderation-description-types";
import type { AdminModerationCopy } from "./admin-moderation-page-types";

export let copy: AdminModerationCopy;
export let description: AdminModerationDescription;
export let descriptionTargetHref: (
  description: AdminModerationDescription,
) => string;
export let formatMessage: (
  template: string,
  values: Record<string, string>,
) => string;
</script>

<Item.Root variant="muted">
  <Item.Content>
    <Item.Description>
      {formatMessage(copy.lastEditor, {
        name: description.lastEditedBy?.name ?? description.lastEditedBy?.username ?? copy.notAvailable,
      })}
    </Item.Description>
  </Item.Content>
  <Item.Actions class="flex-wrap">
    <Button href={descriptionTargetHref(description)} size="sm" variant="outline">{copy.openTarget}</Button>
    {#if description.lastEditedBy?.id}
      <Button href={`/admin/users?search=${encodeURIComponent(description.lastEditedBy.id)}`} size="sm" variant="outline">{copy.manageUser}</Button>
    {/if}
  </Item.Actions>
</Item.Root>
