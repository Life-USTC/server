<script lang="ts">
import { Badge } from "$lib/components/ui/badge/index.js";
import { Button } from "$lib/components/ui/button/index.js";
import * as Card from "$lib/components/ui/card/index.js";
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
export let namePrimary: NamePrimary;
export let sectionCopy: ExamsCopyProps["sectionCopy"];
export let subscriptionsCopy: ExamsCopyProps["subscriptionsCopy"];
</script>

<div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
  {#each exams as exam}
    <Card.Root class="transition hover:border-primary/50" data-slot="card">
      <Card.Content class="grid h-full gap-4 pt-5">
        <div class="grid gap-2">
          <div class="flex items-start justify-between gap-3">
            <a class="min-w-0 font-semibold text-lg underline-offset-4 hover:underline" href={exam.section.jwId ? `/sections/${exam.section.jwId}` : dashboardTabHref("subscriptions")}>
              {exam.courseName}
            </a>
            <Badge variant="outline">
              {exam.completed ? dashboardCopy.nav.exams.filterCompleted : dashboardCopy.nav.exams.filterIncomplete}
            </Badge>
          </div>
          <p class="text-base-content/60 text-sm">
            {exam.section.code ?? subscriptionsCopy.section}{#if exam.section.semester} · {namePrimary(exam.section.semester)}{/if}
          </p>
        </div>

        <dl class="grid gap-2 text-sm">
          <div class="flex items-center justify-between gap-3">
            <dt class="text-base-content/55">{sectionCopy.examDate}</dt>
            <dd class="font-medium">{#if exam.dateKey}{exam.dateKey}{:else}<span class="text-base-content/45">{sectionCopy.examDateTBD}</span>{/if}</dd>
          </div>
          <div class="flex items-center justify-between gap-3">
            <dt class="text-base-content/55">{sectionCopy.examTime}</dt>
            <dd class="font-medium">{examTimeLabel(exam.startTime, exam.endTime) || "—"}</dd>
          </div>
          <div class="flex items-start justify-between gap-3">
            <dt class="text-base-content/55">{sectionCopy.room}</dt>
            <dd class="max-w-48 text-right font-medium">{#if exam.rooms}{exam.rooms}{:else}<span class="text-base-content/45">{sectionCopy.roomTbd}</span>{/if}</dd>
          </div>
        </dl>

        <div class="mt-auto flex flex-wrap items-center justify-between gap-2 border-base-300 border-t pt-3">
          <div class="flex flex-wrap gap-1.5">
            {#if exam.examMode}<Badge variant="secondary">{exam.examMode}</Badge>{/if}
            {#each examMetadataLabels(exam) as label}<Badge variant="secondary">{label}</Badge>{/each}
          </div>
          <Button href={exam.section.jwId ? `/sections/${exam.section.jwId}` : dashboardTabHref("subscriptions")} size="sm" variant="outline">
            {sectionCopy.moreDetails}
          </Button>
        </div>
      </Card.Content>
    </Card.Root>
  {/each}
</div>
