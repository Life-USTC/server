<script lang="ts">
import ArrowUpRight from "@lucide/svelte/icons/arrow-up-right";
import TableIconButton from "$lib/components/TableIconButton.svelte";
import TableRowActions from "$lib/components/TableRowActions.svelte";
import TruncatedText from "$lib/components/TruncatedText.svelte";
import * as Table from "$lib/components/ui/table/index.js";
import type {
  ExamsCopyProps,
  ExamTimeLabel,
  WorkspaceExamRow,
  WorkspaceTabHref,
} from "./workspace-exam-component-types";

export let workspaceTabHref: WorkspaceTabHref;
export let exams: WorkspaceExamRow[];
export let examTimeLabel: ExamTimeLabel;
export let fmtExamDate: (value: Date | string | null | undefined) => string;
export let sectionCopy: ExamsCopyProps["sectionCopy"];
export let subscriptionsCopy: ExamsCopyProps["subscriptionsCopy"];
</script>

<Table.Root class="min-w-0 w-full">
  <Table.Header>
    <Table.Row>
      <Table.Head>{subscriptionsCopy.courseName}</Table.Head>
      <Table.Head>{subscriptionsCopy.section}</Table.Head>
      <Table.Head>{sectionCopy.examDate}</Table.Head>
      <Table.Head>{sectionCopy.examTime}</Table.Head>
      <Table.Head>{sectionCopy.room}</Table.Head>
      <Table.Head
        ><span class="sr-only">{sectionCopy.moreDetails}</span></Table.Head
      >
    </Table.Row>
  </Table.Header>
  <Table.Body>
    {#each exams as exam}
      {@const detailHref = exam.section.jwId
        ? `/catalog/sections/${exam.section.jwId}`
        : workspaceTabHref("subscriptions")}
      <Table.Row class="group">
        <Table.Cell>
          <a
            class="block min-w-0 max-w-full overflow-hidden underline-offset-4 hover:underline"
            href={detailHref}
          >
            <TruncatedText text={exam.courseName} />
          </a>
        </Table.Cell>
        <Table.Cell>
          {exam.section.code ?? subscriptionsCopy.section}
        </Table.Cell>
        <Table.Cell>
          {#if exam.examDate}{fmtExamDate(exam.examDate)}{:else}{sectionCopy.examDateTBD}{/if}
        </Table.Cell>
        <Table.Cell
          >{examTimeLabel(exam.startTime, exam.endTime) || "—"}</Table.Cell
        >
        <Table.Cell>
          {exam.rooms || sectionCopy.roomTbd}
        </Table.Cell>
        <Table.Cell>
          <TableRowActions>
            <TableIconButton href={detailHref} label={sectionCopy.moreDetails}>
              <ArrowUpRight data-icon="inline-start" />
            </TableIconButton>
          </TableRowActions>
        </Table.Cell>
      </Table.Row>
    {/each}
  </Table.Body>
</Table.Root>
