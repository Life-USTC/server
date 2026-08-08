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

{#key `comments:homework:${homework.id}`}
  <CommentsPanel
    heading={homeworksCopy.commentsTitle}
    {permalinkBaseHref}
    targetId={homework.id}
    targetType="homework"
  />
{/key}
