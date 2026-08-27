<script lang="ts">
import type { HomeworkDetailModel } from "@/features/homeworks/lib/homework-presentation";
import type {
  HomeworkDetailCommentsPanel,
  HomeworkDetailCopy,
} from "./homework-detail-types";

export let CommentsPanel: HomeworkDetailCommentsPanel;
export let copy: HomeworkDetailCopy;
export let homework: HomeworkDetailModel;
export let permalinkBaseHref: string | null = null;
</script>

<section class="min-w-0 pt-1" data-testid="homework-discussion">
  <h2 class="text-base font-semibold">{copy.commentsTitle}</h2>
  <div class="mt-3">
    {#key `comments:homework:${homework.id}`}
      <CommentsPanel
        {permalinkBaseHref}
        targetId={homework.id}
        targetType="homework"
      />
    {/key}
  </div>
</section>
