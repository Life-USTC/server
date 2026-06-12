<script lang="ts">
import { Badge } from "$lib/components/ui/badge/index.js";
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
    <button
      class={`rounded-md border border-base-300 border-l-4 bg-base-100 p-4 text-left transition hover:border-primary/40 hover:shadow-sm ${statusBorderClass(comment.status)}`}
      data-slot="card"
      type="button"
      onclick={() => onManage(comment)}
    >
      <div class="grid gap-3">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div class="min-w-0">
            <h2 class="truncate font-semibold text-lg">{targetLabel(comment)}</h2>
            <p class="text-base-content/60 text-sm">
              {commentAuthorLabel(comment)} · {formatDate(comment.createdAt)}
            </p>
          </div>
          <Badge class={statusBadgeClass(comment.status)}>{statusLabel(comment.status)}</Badge>
        </div>
        <p class="line-clamp-3 whitespace-pre-wrap text-sm">{comment.body}</p>
      </div>
    </button>
  {/each}
</div>
