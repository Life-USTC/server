<script lang="ts">
import HomeworkDetailMetaGrid from "@/features/homeworks/components/HomeworkDetailMetaGrid.svelte";
import HomeworkDetailTags from "@/features/homeworks/components/HomeworkDetailTags.svelte";
import {
  buildHomeworkDetailMetaRows,
  buildHomeworkDetailTags,
} from "@/features/homeworks/lib/homework-detail-meta";
import type {
  DashboardHomeworkDetailCopy,
  DashboardHomeworkDetailFormatter,
  DashboardHomeworkDetailItem,
} from "./dashboard-homework-detail-types";

export let fmtDate: DashboardHomeworkDetailFormatter;
export let homework: DashboardHomeworkDetailItem;
export let homeworkEtaLabel: DashboardHomeworkDetailFormatter;
export let homeworksCopy: DashboardHomeworkDetailCopy;

$: metaRows = buildHomeworkDetailMetaRows({
  dueHint: homeworkEtaLabel(homework.submissionDueAt),
  formatDate: fmtDate,
  homework,
  labels: {
    publishedAt: homeworksCopy.homeworkPublishedAt,
    submissionDue: homeworksCopy.submissionDue,
    submissionStart: homeworksCopy.submissionStart,
  },
});
$: tags = buildHomeworkDetailTags({ homework, labels: homeworksCopy });
</script>

<HomeworkDetailMetaGrid rows={metaRows} />

<HomeworkDetailTags {tags} />
