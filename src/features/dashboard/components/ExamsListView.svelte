<script lang="ts">
import { Button } from "$lib/components/ui/button/index.js";
import * as Table from "$lib/components/ui/table/index.js";
import type {
  DashboardExamRow,
  DashboardTabHref,
  ExamsCopyProps,
  ExamTimeLabel,
} from "./dashboard-exam-component-types";

export let dashboardCopy: ExamsCopyProps["dashboardCopy"];
export let dashboardTabHref: DashboardTabHref;
export let exams: DashboardExamRow[];
export let examTimeLabel: ExamTimeLabel;
export let sectionCopy: ExamsCopyProps["sectionCopy"];
export let subscriptionsCopy: ExamsCopyProps["subscriptionsCopy"];
</script>

<Table.Root>
  <Table.Header>
    <Table.Row>
      <Table.Head>{dashboardCopy.nav.exams.title}</Table.Head>
      <Table.Head>{subscriptionsCopy.section}</Table.Head>
      <Table.Head class="text-center">{sectionCopy.examDate}</Table.Head>
      <Table.Head class="text-center">{sectionCopy.examTime}</Table.Head>
      <Table.Head>{sectionCopy.room}</Table.Head>
      <Table.Head class="text-right"><span class="sr-only">{sectionCopy.moreDetails}</span></Table.Head>
    </Table.Row>
  </Table.Header>
  <Table.Body>
    {#each exams as exam}
      <Table.Row>
        <Table.Cell class="max-w-0">
          <a class="block max-w-full truncate font-semibold underline-offset-4 hover:underline" href={exam.section.jwId ? `/sections/${exam.section.jwId}` : dashboardTabHref("subscriptions")}>
            {exam.courseName}
          </a>
        </Table.Cell>
        <Table.Cell class="max-w-48 truncate text-base-content/70">{exam.section.code ?? subscriptionsCopy.section}</Table.Cell>
        <Table.Cell class="text-center">
          {#if exam.dateKey}{exam.dateKey}{:else}<span class="text-base-content/45">{sectionCopy.examDateTBD}</span>{/if}
        </Table.Cell>
        <Table.Cell class="text-center">{examTimeLabel(exam.startTime, exam.endTime) || "—"}</Table.Cell>
        <Table.Cell class="max-w-56 truncate text-base-content/70">{exam.rooms || sectionCopy.roomTbd}</Table.Cell>
        <Table.Cell>
          <div class="flex justify-end">
            <Button href={exam.section.jwId ? `/sections/${exam.section.jwId}` : dashboardTabHref("subscriptions")} size="sm" variant="outline">
              {sectionCopy.moreDetails}
            </Button>
          </div>
        </Table.Cell>
      </Table.Row>
    {/each}
  </Table.Body>
</Table.Root>
