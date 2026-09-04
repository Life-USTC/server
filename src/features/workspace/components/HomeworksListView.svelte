<script lang="ts">
import ArrowUpRight from "@lucide/svelte/icons/arrow-up-right";
import CheckCircleIcon from "@lucide/svelte/icons/check-circle";
import RefreshCw from "@lucide/svelte/icons/refresh-cw";
import { homeworkSummaryBadges } from "@/features/homeworks/lib/homework-presentation";
import type { DashboardHomeworkItem } from "@/features/workspace/lib/dashboard-controller-types";
import TableIconButton from "$lib/components/TableIconButton.svelte";
import TableRowActions from "$lib/components/TableRowActions.svelte";
import TruncatedText from "$lib/components/TruncatedText.svelte";
import { Badge } from "$lib/components/ui/badge/index.js";
import { Button } from "$lib/components/ui/button/index.js";
import * as Empty from "$lib/components/ui/empty/index.js";
import { Spinner } from "$lib/components/ui/spinner/index.js";
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
export let homeworkSectionHref: HomeworkAction;
export let homeworksCopy: Record<string, string>;
export let homeworkSavingById: Record<string, boolean>;
export let selectedHomework: DashboardHomeworkItem | null;
export let toggleHomeworkCompletion: (
  homework: DashboardHomeworkItem,
) => void | Promise<void>;

function summaryBadges(homework: DashboardHomeworkItem) {
  return homeworkSummaryBadges(
    {
      completed: Boolean(homework.completion),
      isMajor: homework.isMajor === true,
      requiresTeam: homework.requiresTeam === true,
    },
    {
      completed: homeworksCopy.completedLabel,
      major: homeworksCopy.tagMajor,
      team: homeworksCopy.tagTeam,
    },
  );
}
</script>

<Table.Root class="min-w-0 w-full" data-testid="dashboard-homeworks-list">
  <Table.Header>
    <Table.Row>
      <Table.Head>{homeworksCopy.sectionLabel}</Table.Head>
      <Table.Head>{homeworksCopy.titleLabel}</Table.Head>
      <Table.Head>{homeworksCopy.submissionDue}</Table.Head>
      <Table.Head>{homeworksCopy.statusLabel}</Table.Head>
      <Table.Head>
        <span class="sr-only">{homeworksCopy.markComplete}</span>
      </Table.Head>
    </Table.Row>
  </Table.Header>
  <Table.Body>
    {#each filteredHomeworkItems as homework}
      <Table.Row class="group">
        <Table.Cell>
          <a
            class="hover:underline"
            href={homeworkSectionHref(homework)}
          >
            {homework.section?.courseName ?? homeworkCopy.section}
          </a>
        </Table.Cell>
        <Table.Cell>
          <button
            class="block min-h-11 min-w-0 max-w-full text-left hover:underline"
            type="button"
            onclick={() => {
              selectedHomework = homework;
            }}
          >
            <TruncatedText text={homework.title} lines={2} />
          </button>
        </Table.Cell>
        <Table.Cell>
          {fmtDate(homework.submissionDueAt)}
        </Table.Cell>
        <Table.Cell>
          <div class="flex min-w-0 flex-wrap items-center gap-1.5">
            <Badge
              variant={homeworkIsOverdue(homework.submissionDueAt)
                ? "destructive"
                : "ghost"}
            >
              {homeworkEtaLabel(homework.submissionDueAt)}
            </Badge>
            {#each summaryBadges(homework) as badge (badge.key)}
              <Badge variant={badge.variant}>{badge.label}</Badge>
            {/each}
          </div>
        </Table.Cell>
        <Table.Cell>
          <TableRowActions>
            <TableIconButton
            disabled={homeworkSavingById[homework.id]}
            label={homeworkSavingById[homework.id]
              ? homeworksCopy.saving
              : homeworkCompletionActionLabel(homework)}
            variant={homework.completion ? "secondary" : "default"}
            onclick={() => toggleHomeworkCompletion(homework)}
            >
              {#if homeworkSavingById[homework.id]}
                <Spinner data-icon="inline-start" />
              {:else if homework.completion}
                <RefreshCw data-icon="inline-start" />
              {:else}
                <CheckCircleIcon data-icon="inline-start" />
              {/if}
            </TableIconButton>
            <TableIconButton
              label={homeworksCopy.viewDetails}
              variant="outline"
              onclick={() => {
                selectedHomework = homework;
              }}
            >
              <ArrowUpRight data-icon="inline-start" />
            </TableIconButton>
          </TableRowActions>
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
