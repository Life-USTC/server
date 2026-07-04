<script lang="ts">
import { Badge } from "$lib/components/ui/badge/index.js";
import { Button } from "$lib/components/ui/button/index.js";
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

<div class="grid gap-3 md:hidden">
  {#each comments as comment}
    <Button
      class={`h-auto w-full justify-start border-l-4 p-4 text-left whitespace-normal ${statusBorderClass(comment.status)}`}
      variant="outline"
      type="button"
      onclick={() => onManage(comment)}
    >
      <span class="grid w-full gap-3">
        <span class="flex flex-wrap items-start justify-between gap-3">
          <span class="min-w-0">
            <span class="block truncate font-semibold text-lg">{targetLabel(comment)}</span>
            <span class="block text-muted-foreground text-sm">
              {commentAuthorLabel(comment)} · {formatDate(comment.createdAt)}
            </span>
          </span>
          <Badge class={statusBadgeClass(comment.status)}>{statusLabel(comment.status)}</Badge>
        </span>
        <span class="line-clamp-3 whitespace-pre-wrap text-sm">{comment.body}</span>
      </span>
    </Button>
  {/each}
</div>
