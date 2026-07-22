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

<div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3" data-testid="dashboard-exams-cards">
  {#each exams as exam}
    <Card.Root data-slot="card">
      <Card.Header>
        <Card.Title>
          <a class="underline-offset-4 hover:underline" href={exam.section.jwId ? `/sections/${exam.section.jwId}` : dashboardTabHref("subscriptions")}>
            {exam.courseName}
          </a>
        </Card.Title>
        <Card.Description>
          {exam.section.code ?? subscriptionsCopy.section}{#if exam.section.semester} · {namePrimary(exam.section.semester)}{/if}
        </Card.Description>
        <Card.Action>
          <Badge variant="outline">
            {exam.completed ? dashboardCopy.nav.exams.filterCompleted : dashboardCopy.nav.exams.filterIncomplete}
          </Badge>
        </Card.Action>
      </Card.Header>
      <Card.Content>
        <dl class="grid gap-2 text-sm">
          <div class="flex items-center justify-between gap-3">
            <dt class="text-muted-foreground">{sectionCopy.examDate}</dt>
            <dd class="font-medium">{#if exam.dateKey}{exam.dateKey}{:else}<span class="text-muted-foreground">{sectionCopy.examDateTBD}</span>{/if}</dd>
          </div>
          <div class="flex items-center justify-between gap-3">
            <dt class="text-muted-foreground">{sectionCopy.examTime}</dt>
            <dd class="font-medium">{examTimeLabel(exam.startTime, exam.endTime) || "—"}</dd>
          </div>
          <div class="flex items-start justify-between gap-3">
            <dt class="text-muted-foreground">{sectionCopy.room}</dt>
            <dd class="max-w-48 text-right font-medium">{#if exam.rooms}{exam.rooms}{:else}<span class="text-muted-foreground">{sectionCopy.roomTbd}</span>{/if}</dd>
          </div>
        </dl>
      </Card.Content>
      <Card.Footer class="flex-wrap justify-between gap-2">
        <div class="flex flex-wrap gap-1.5">
          {#if exam.examMode}<Badge variant="secondary">{exam.examMode}</Badge>{/if}
          {#each examMetadataLabels(exam) as label}<Badge variant="secondary">{label}</Badge>{/each}
        </div>
        <Button href={exam.section.jwId ? `/sections/${exam.section.jwId}` : dashboardTabHref("subscriptions")} size="sm" variant="outline">
          {sectionCopy.moreDetails}
        </Button>
      </Card.Footer>
    </Card.Root>
  {/each}
</div>
