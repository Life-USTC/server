<script lang="ts">
import { commentTargetPermalinkBaseHref } from "@/features/comments/lib/comment-panel-controller";
import type {
  DashboardHomeworkCommentsPanel,
  DashboardHomeworkDetailCopy,
  DashboardHomeworkDetailItem,
} from "./dashboard-homework-detail-types";

export let CommentsPanel: DashboardHomeworkCommentsPanel;
export let homework: DashboardHomeworkDetailItem;
export let homeworksCopy: DashboardHomeworkDetailCopy;

$: permalinkBaseHref = homework.section?.jwId
  ? commentTargetPermalinkBaseHref({
      homeworkId: homework.id,
      sectionJwId: homework.section.jwId,
      type: "homework",
    })
  : null;
</script>

<section class="min-w-0 border-t pt-6">
  <h3 class="font-semibold text-base">{homeworksCopy.commentsTitle}</h3>
  <div class="mt-4">
    {#key `comments:homework:${homework.id}`}
      <CommentsPanel {permalinkBaseHref} targetId={homework.id} targetType="homework" />
    {/key}
  </div>
</section>
