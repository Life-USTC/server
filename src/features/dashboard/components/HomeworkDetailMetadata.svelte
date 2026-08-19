<script lang="ts">
import HomeworkDetailTags from "@/features/homeworks/components/HomeworkDetailTags.svelte";
import HomeworkDueSummary from "@/features/homeworks/components/HomeworkDueSummary.svelte";
import HomeworkMetaList from "@/features/homeworks/components/HomeworkMetaList.svelte";
import {
  buildHomeworkDetailTags,
  buildHomeworkDueSummary,
  buildHomeworkMetadataRows,
} from "@/features/homeworks/lib/homework-detail-meta";
import type {
  DashboardHomeworkDetailAction,
  DashboardHomeworkDetailCopy,
  DashboardHomeworkDetailFormatter,
  DashboardHomeworkDetailItem,
} from "./dashboard-homework-detail-types";

export let fmtDate: DashboardHomeworkDetailFormatter;
export let homework: DashboardHomeworkDetailItem;
export let homeworkEtaLabel: DashboardHomeworkDetailFormatter;
export let homeworkStatus: DashboardHomeworkDetailAction;
export let homeworksCopy: DashboardHomeworkDetailCopy;

$: dueSummary = buildHomeworkDueSummary({
  completed: Boolean(homework.completion),
  dueLabel: homeworksCopy.submissionDue,
  etaLabel: homeworkEtaLabel(homework.submissionDueAt),
  formatDate: fmtDate,
  homework,
  statusLabel: homeworkStatus(homework),
});
$: metaRows = buildHomeworkMetadataRows({
  formatDate: fmtDate,
  homework,
  labels: {
    publishedAt: homeworksCopy.homeworkPublishedAt,
    submissionStart: homeworksCopy.submissionStart,
  },
});
$: tags = buildHomeworkDetailTags({ homework, labels: homeworksCopy });
</script>

<HomeworkDueSummary summary={dueSummary} />

<HomeworkMetaList rows={metaRows} />

<HomeworkDetailTags {tags} />
