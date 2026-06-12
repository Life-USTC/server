<script lang="ts">
import type {
  DashboardHomeworkCommentsPanel,
  DashboardHomeworkDetailCopy,
  DashboardHomeworkDetailItem,
} from "./dashboard-homework-detail-types";

export let CommentsPanel: DashboardHomeworkCommentsPanel;
export let homework: DashboardHomeworkDetailItem;
export let homeworksCopy: DashboardHomeworkDetailCopy;
</script>

<aside class="min-w-0 border-base-300 border-t pt-5 lg:border-t-0 lg:border-l lg:pl-5 lg:pt-0">
  <h3 class="font-semibold text-base">{homeworksCopy.commentsTitle}</h3>
  <p class="mt-1 mb-3 text-base-content/60 text-sm">{homeworksCopy.commentsLabel}</p>
  <CommentsPanel targetId={homework.id} targetType="homework" />
</aside>
