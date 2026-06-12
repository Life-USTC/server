<script lang="ts">
import { Button } from "$lib/components/ui/button/index.js";
import type { AdminModerationComment } from "./admin-moderation-comment-types";
import type { AdminModerationCopy } from "./admin-moderation-page-types";

export let comment: AdminModerationComment;
export let copy: AdminModerationCopy;
export let targetHref: (comment: AdminModerationComment) => string;
</script>

<section class="rounded border border-base-300 bg-base-200/40 p-4">
  <p class="whitespace-pre-wrap text-sm">{comment.body}</p>
  <div class="mt-3 flex flex-wrap gap-2">
    <Button href={targetHref(comment)} size="sm" variant="outline">{copy.openTarget}</Button>
    {#if comment.user?.id}
      <Button href={`/admin/users?search=${encodeURIComponent(comment.user.id)}`} size="sm" variant="outline">{copy.manageUser}</Button>
    {/if}
  </div>
</section>
