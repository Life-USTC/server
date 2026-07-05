<script lang="ts">
import { Button } from "$lib/components/ui/button/index.js";
import * as Item from "$lib/components/ui/item/index.js";
import type { AdminModerationComment } from "./admin-moderation-comment-types";
import type { AdminModerationCopy } from "./admin-moderation-page-types";

export let comment: AdminModerationComment;
export let copy: AdminModerationCopy;
export let targetHref: (comment: AdminModerationComment) => string;
</script>

<Item.Root variant="muted" class="items-start">
  <Item.Content>
    <p class="whitespace-pre-wrap text-sm">{comment.body}</p>
  </Item.Content>
  <Item.Actions class="flex-wrap">
    <Button href={targetHref(comment)} size="sm" variant="outline">{copy.openTarget}</Button>
    {#if comment.user?.id}
      <Button href={`/admin/users?search=${encodeURIComponent(comment.user.id)}`} size="sm" variant="outline">{copy.manageUser}</Button>
    {/if}
  </Item.Actions>
</Item.Root>
