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

<section class="min-w-0" data-testid="homework-discussion">
  {#key `comments:homework:${homework.id}`}
    <CommentsPanel
      heading={copy.commentsTitle}
      {permalinkBaseHref}
      targetId={homework.id}
      targetType="homework"
    />
  {/key}
</section>
