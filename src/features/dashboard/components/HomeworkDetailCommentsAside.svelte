<script lang="ts">
import { commentTargetPermalinkBaseHref } from "@/features/comments/lib/comment-panel-controller";
import { Separator } from "$lib/components/ui/separator/index.js";
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

<aside class="min-w-0">
  <Separator class="mb-5 lg:hidden" />
  <div class="lg:grid lg:grid-cols-[auto_minmax(0,1fr)] lg:gap-5">
    <Separator class="hidden lg:block" orientation="vertical" />
    <div class="min-w-0">
      <h3 class="font-semibold text-base">{homeworksCopy.commentsTitle}</h3>
      <p class="mt-1 mb-3 text-base-content/60 text-sm">{homeworksCopy.commentsLabel}</p>
      {#key `comments:homework:${homework.id}`}
        <CommentsPanel {permalinkBaseHref} targetId={homework.id} targetType="homework" />
      {/key}
    </div>
  </div>
</aside>
