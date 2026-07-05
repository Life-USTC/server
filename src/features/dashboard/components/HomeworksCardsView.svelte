<script lang="ts">
import type { DashboardHomeworkItem } from "@/features/dashboard/lib/dashboard-controller-types";
import { Badge } from "$lib/components/ui/badge/index.js";
import { Button } from "$lib/components/ui/button/index.js";
import * as Card from "$lib/components/ui/card/index.js";
import * as Empty from "$lib/components/ui/empty/index.js";

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
      <Card.Header>
        <Card.Title>
          <button
            class="text-left underline-offset-4 hover:underline"
            type="button"
            onclick={() => {
              selectedHomework = homework;
            }}
          >
            {homework.title}
          </button>
        </Card.Title>
        <Card.Description>
          {homework.section?.courseName ?? homeworkCopy.section} · {homeworkCopy.due}:
          {fmtDate(homework.submissionDueAt)}
        </Card.Description>
        <Card.Action>
          {#if homework.completion}
            <Badge variant="outline">
              {homeworksCopy.completedLabel}
            </Badge>
          {/if}
        </Card.Action>
      </Card.Header>
      <Card.Content>
        <div class="flex flex-wrap gap-2">
          <Badge variant="ghost">{homeworkEtaLabel(homework.submissionDueAt)}</Badge>
          {#if homework.isMajor}<Badge variant="secondary">{homeworksCopy.tagMajor}</Badge>{/if}
          {#if homework.requiresTeam}<Badge variant="secondary">{homeworksCopy.tagTeam}</Badge>{/if}
        </div>
      </Card.Content>
      <Card.Footer class="justify-end">
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
      </Card.Footer>
    </Card.Root>
  {:else}
    <Empty.Root class="min-h-24 border border-border bg-background md:col-span-2">
      <Empty.Header>
        <Empty.Title>{homeworksCopy.filterEmptyTitle}</Empty.Title>
      </Empty.Header>
    </Empty.Root>
  {/each}
</div>
