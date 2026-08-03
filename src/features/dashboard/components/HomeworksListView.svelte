<script lang="ts">
import type { DashboardHomeworkItem } from "@/features/dashboard/lib/dashboard-controller-types";
import TruncatedText from "$lib/components/TruncatedText.svelte";
import { Badge } from "$lib/components/ui/badge/index.js";
import { Button } from "$lib/components/ui/button/index.js";
import * as Empty from "$lib/components/ui/empty/index.js";
import * as Table from "$lib/components/ui/table/index.js";

type HomeworkDateFormatter = (
  value: Date | string | null | undefined,
) => string;
type HomeworkOverduePredicate = (
  value: Date | string | null | undefined,
) => boolean;
type HomeworkAction = (homework: DashboardHomeworkItem) => string;

export let filteredHomeworkItems: DashboardHomeworkItem[];
export let hasHomeworkItems: boolean;
export let onClearFilter: () => void;
export let fmtDate: HomeworkDateFormatter;
export let homeworkCompletionActionLabel: HomeworkAction;
export let homeworkCopy: Record<string, string>;
export let homeworkEtaLabel: HomeworkDateFormatter;
export let homeworkIsOverdue: HomeworkOverduePredicate;
export let homeworksCopy: Record<string, string>;
export let homeworkSavingById: Record<string, boolean>;
export let selectedHomework: DashboardHomeworkItem | null;
export let toggleHomeworkCompletion: (
  homework: DashboardHomeworkItem,
) => void | Promise<void>;
</script>

<Table.Root class="min-w-0" data-testid="dashboard-homeworks-list">
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
            class="block min-w-0 max-w-full overflow-hidden text-left font-semibold hover:underline"
            type="button"
            onclick={() => {
              selectedHomework = homework;
            }}
          >
            <TruncatedText text={homework.title} />
          </button>
        </Table.Cell>
        <Table.Cell class="max-w-64">
          <TruncatedText
            class="text-muted-foreground"
            text={homework.section?.courseName ?? homeworkCopy.section}
          />
        </Table.Cell>
        <Table.Cell class="text-center">
          <span class="font-medium text-sm">{fmtDate(homework.submissionDueAt)}</span>
        </Table.Cell>
        <Table.Cell>
          <div class="flex flex-wrap items-center gap-1.5">
            <Badge
              variant={homeworkIsOverdue(homework.submissionDueAt) ? "destructive" : "ghost"}
            >
              {homeworkEtaLabel(homework.submissionDueAt)}
            </Badge>
            {#if homework.completion}
              <Badge variant="secondary">
                {homeworksCopy.completedLabel}
              </Badge>
            {/if}
            {#if homework.isMajor}
              <Badge>
                {homeworksCopy.tagMajor}
              </Badge>
            {/if}
            {#if homework.requiresTeam}
              <Badge variant="outline">
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
        <Table.Cell class="p-0" colspan={5}>
          <Empty.Root class="items-start py-8 text-left">
            <Empty.Header class="items-start text-left">
              <Empty.Title>{homeworksCopy.filterEmptyTitle}</Empty.Title>
              {#if hasHomeworkItems}
                <Empty.Description>
                  {homeworksCopy.filterEmptyDescription}
                </Empty.Description>
              {/if}
            </Empty.Header>
            {#if hasHomeworkItems}
              <Empty.Content class="items-start">
                <Button variant="outline" onclick={onClearFilter}>
                  {homeworksCopy.clearFilter}
                </Button>
              </Empty.Content>
            {/if}
          </Empty.Root>
        </Table.Cell>
      </Table.Row>
    {/each}
  </Table.Body>
</Table.Root>
