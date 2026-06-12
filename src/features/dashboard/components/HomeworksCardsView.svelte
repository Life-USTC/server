<script lang="ts">
import type { DashboardHomeworkItem } from "@/features/dashboard/lib/dashboard-controller-types";
import { Alert } from "$lib/components/ui/alert/index.js";
import { Badge } from "$lib/components/ui/badge/index.js";
import { Button } from "$lib/components/ui/button/index.js";
import * as Card from "$lib/components/ui/card/index.js";

type HomeworkDateFormatter = (
  value: Date | string | null | undefined,
) => string;
type HomeworkAction = (homework: DashboardHomeworkItem) => string;

export let filteredHomeworkItems: DashboardHomeworkItem[];
export let fmtDate: HomeworkDateFormatter;
export let homeworkCompletionActionLabel: HomeworkAction;
export let homeworkCopy: Record<string, string>;
export let homeworkEtaLabel: HomeworkDateFormatter;
export let homeworksCopy: Record<string, string>;
export let homeworkSavingById: Record<string, boolean>;
export let selectedHomework: DashboardHomeworkItem | null;
export let toggleHomeworkCompletion: (
  homework: DashboardHomeworkItem,
) => void | Promise<void>;
</script>

<div class="grid gap-3 md:grid-cols-2" data-testid="dashboard-homeworks-cards">
  {#each filteredHomeworkItems as homework}
    <Card.Root
      class="group transition hover:border-primary"
      data-slot="card"
      id={`homework-${homework.id}`}
    >
      <Card.Content class="grid gap-3 pt-5">
        <div class="flex flex-wrap items-start justify-between gap-2">
          <button
            class="text-left font-semibold text-lg hover:underline"
            type="button"
            onclick={() => {
              selectedHomework = homework;
            }}
          >
            {homework.title}
          </button>
          {#if homework.completion}
            <Badge variant="outline">
              {homeworksCopy.completedLabel}
            </Badge>
          {/if}
        </div>
        <p class="text-base-content/60 text-sm">
          {homework.section?.courseName ?? homeworkCopy.section} · {homeworkCopy.due}
          {fmtDate(homework.submissionDueAt)}
        </p>
        <div class="flex flex-wrap gap-2">
          <Badge variant="ghost">{homeworkEtaLabel(homework.submissionDueAt)}</Badge>
          {#if homework.isMajor}<Badge variant="secondary">{homeworksCopy.tagMajor}</Badge>{/if}
          {#if homework.requiresTeam}<Badge variant="secondary">{homeworksCopy.tagTeam}</Badge>{/if}
        </div>
        <div class="flex justify-end">
          <Button
            disabled={homeworkSavingById[homework.id]}
            size="sm"
            type="button"
            variant="outline"
            onclick={() => toggleHomeworkCompletion(homework)}
          >
            {homeworkSavingById[homework.id]
              ? homeworksCopy.saving
              : homeworkCompletionActionLabel(homework)}
          </Button>
        </div>
      </Card.Content>
    </Card.Root>
  {:else}
    <Alert class="md:col-span-2">{homeworksCopy.filterEmptyTitle}</Alert>
  {/each}
</div>
