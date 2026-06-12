<script lang="ts">
import type { DashboardHomeworkItem } from "@/features/dashboard/lib/dashboard-controller-types";
import { Badge } from "$lib/components/ui/badge/index.js";
import { Button } from "$lib/components/ui/button/index.js";
import * as Table from "$lib/components/ui/table/index.js";

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

<Table.Root data-testid="dashboard-homeworks-list">
  <Table.Header>
    <Table.Row>
      <Table.Head>{homeworksCopy.titleLabel}</Table.Head>
      <Table.Head>{homeworksCopy.sectionLabel}</Table.Head>
      <Table.Head class="text-center">{homeworksCopy.submissionDue}</Table.Head>
      <Table.Head>{homeworksCopy.selected}</Table.Head>
      <Table.Head class="text-right">
        <span class="sr-only">{homeworksCopy.markComplete}</span>
      </Table.Head>
    </Table.Row>
  </Table.Header>
  <Table.Body>
    {#each filteredHomeworkItems as homework}
      <Table.Row>
        <Table.Cell class="max-w-0">
          <button
            class="block max-w-full truncate text-left font-semibold hover:underline"
            type="button"
            onclick={() => {
              selectedHomework = homework;
            }}
          >
            {homework.title}
          </button>
        </Table.Cell>
        <Table.Cell class="max-w-64">
          <span class="block truncate text-base-content/70">
            {homework.section?.courseName ?? homeworkCopy.section}
          </span>
        </Table.Cell>
        <Table.Cell class="text-center">
          <span class="font-medium text-sm">{fmtDate(homework.submissionDueAt)}</span>
        </Table.Cell>
        <Table.Cell>
          <div class="flex flex-wrap items-center gap-1.5">
            <Badge variant="ghost">
              {homeworkEtaLabel(homework.submissionDueAt)}
            </Badge>
            {#if homework.completion}
              <Badge class="border-success/40 bg-success/10 text-success">
                {homeworksCopy.completedLabel}
              </Badge>
            {/if}
            {#if homework.isMajor}
              <Badge class="border-warning/40 bg-warning/10 text-warning">
                {homeworksCopy.tagMajor}
              </Badge>
            {/if}
            {#if homework.requiresTeam}
              <Badge class="border-info/40 bg-info/10 text-info">
                {homeworksCopy.tagTeam}
              </Badge>
            {/if}
          </div>
        </Table.Cell>
        <Table.Cell>
          <div class="flex justify-end">
            <Button
              class="h-8 whitespace-nowrap"
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
        </Table.Cell>
      </Table.Row>
    {:else}
      <Table.Row>
        <Table.Cell class="py-8 text-center text-base-content/60" colspan={5}>
          {homeworksCopy.filterEmptyTitle}
        </Table.Cell>
      </Table.Row>
    {/each}
  </Table.Body>
</Table.Root>
