<script lang="ts">
import ArrowUpRight from "@lucide/svelte/icons/arrow-up-right";
import { Badge } from "$lib/components/ui/badge/index.js";
import * as Item from "$lib/components/ui/item/index.js";
import DashboardTableIconButton from "./DashboardTableIconButton.svelte";
import type {
  DashboardExamRow,
  DashboardTabHref,
  ExamMetadataLabels,
  ExamsCopyProps,
  ExamTimeLabel,
  NamePrimary,
} from "./dashboard-exam-component-types";

export let dashboardCopy: ExamsCopyProps["dashboardCopy"];
export let dashboardTabHref: DashboardTabHref;
export let exams: DashboardExamRow[];
export let examMetadataLabels: ExamMetadataLabels;
export let examTimeLabel: ExamTimeLabel;
export let fmtExamDate: (value: Date | string | null | undefined) => string;
export let namePrimary: NamePrimary;
export let sectionCopy: ExamsCopyProps["sectionCopy"];
export let subscriptionsCopy: ExamsCopyProps["subscriptionsCopy"];
</script>

<div class="min-w-0" data-testid="dashboard-exams-cards">
  <Item.Group class="gap-0">
  {#each exams as exam, index (exam.id)}
    {@const detailHref = exam.section.jwId
      ? `/catalog/sections/${exam.section.jwId}`
      : dashboardTabHref("subscriptions")}
    <Item.Root class="items-start gap-3 px-2 py-3">
      <Item.Content class="min-w-0 gap-1">
        <Item.Title class="line-clamp-none w-full min-w-0">
          <a
            class="flex min-h-11 w-full min-w-0 max-w-full items-center underline-offset-4 hover:underline"
            href={detailHref}
          >
            <span class="line-clamp-2 min-w-0 max-w-full break-words">
            {exam.courseName}
            </span>
          </a>
        </Item.Title>
        <Item.Description
          class="line-clamp-none flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 break-words"
        >
          <span class="max-w-full break-words">
            {exam.section.code ?? subscriptionsCopy.section}{#if exam.section.semester} · {namePrimary(exam.section.semester)}{/if}
          </span>
          <span class="max-w-full break-words">
            {sectionCopy.examDate}: {#if exam.examDate}{fmtExamDate(exam.examDate)}{:else}{sectionCopy.examDateTBD}{/if}
          </span>
          <span class="max-w-full break-words">
            {sectionCopy.examTime}: {examTimeLabel(exam.startTime, exam.endTime) || "—"}
          </span>
          <span class="max-w-full break-words">
            {sectionCopy.room}: {exam.rooms || sectionCopy.roomTbd}
          </span>
          <Badge variant="outline">
            {exam.completed ? dashboardCopy.nav.exams.filterCompleted : dashboardCopy.nav.exams.filterIncomplete}
          </Badge>
          {#if exam.examMode}<Badge variant="secondary">{exam.examMode}</Badge>{/if}
          {#each examMetadataLabels(exam) as label}<Badge variant="secondary">{label}</Badge>{/each}
        </Item.Description>
      </Item.Content>
      <Item.Actions class="shrink-0 self-start">
        <DashboardTableIconButton
          className="size-11"
          href={detailHref}
          label={sectionCopy.moreDetails}
        >
          <ArrowUpRight />
        </DashboardTableIconButton>
      </Item.Actions>
    </Item.Root>
    {#if index < exams.length - 1}
      <Item.Separator class="my-0" />
    {/if}
  {/each}
  </Item.Group>
</div>
