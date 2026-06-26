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

<aside class="min-w-0 border-base-300 border-t pt-5 lg:border-t-0 lg:border-l lg:pl-5 lg:pt-0">
  <h3 class="font-semibold text-base">{homeworksCopy.commentsTitle}</h3>
  <p class="mt-1 mb-3 text-base-content/60 text-sm">{homeworksCopy.commentsLabel}</p>
  {#key `comments:homework:${homework.id}`}
    <CommentsPanel {permalinkBaseHref} targetId={homework.id} targetType="homework" />
  {/key}
</aside>
