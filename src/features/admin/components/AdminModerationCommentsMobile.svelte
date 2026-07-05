<script lang="ts">
import { Badge } from "$lib/components/ui/badge/index.js";
import * as Item from "$lib/components/ui/item/index.js";
import type {
  AdminModerationComment,
  AdminModerationCommentFormatter,
  AdminModerationCommentStatusFormatter,
} from "./admin-moderation-comment-types";

export let comments: AdminModerationComment[];
export let commentAuthorLabel: AdminModerationCommentFormatter;
export let formatDate: (value: string | Date) => string;
export let onManage: (comment: AdminModerationComment) => void;
export let statusBadgeClass: AdminModerationCommentStatusFormatter;
export let statusBorderClass: AdminModerationCommentStatusFormatter;
export let statusLabel: AdminModerationCommentStatusFormatter;
export let targetLabel: AdminModerationCommentFormatter;
</script>

<Item.Group class="md:hidden">
  {#each comments as comment}
    <Item.Root variant="outline" class={`items-start border-l-4 ${statusBorderClass(comment.status)}`}>
      {#snippet child({ props })}
        <button {...props} type="button" onclick={() => onManage(comment)}>
          <Item.Content class="min-w-0">
            <Item.Title>{targetLabel(comment)}</Item.Title>
            <Item.Description>
              {commentAuthorLabel(comment)} · {formatDate(comment.createdAt)}
            </Item.Description>
            <Item.Description class="line-clamp-3 whitespace-pre-wrap">
              {comment.body}
            </Item.Description>
          </Item.Content>
          <Item.Actions>
          <Badge class={statusBadgeClass(comment.status)}>{statusLabel(comment.status)}</Badge>
          </Item.Actions>
        </button>
      {/snippet}
    </Item.Root>
  {/each}
</Item.Group>
