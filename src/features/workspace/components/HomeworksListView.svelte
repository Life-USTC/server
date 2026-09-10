<script lang="ts">
import ArrowUpRight from "@lucide/svelte/icons/arrow-up-right";
import CheckCircleIcon from "@lucide/svelte/icons/check-circle";
import RefreshCw from "@lucide/svelte/icons/refresh-cw";
import { homeworkSummaryBadges } from "@/features/homeworks/lib/homework-presentation";
import type { WorkspaceHomeworkItem } from "@/features/workspace/lib/workspace-controller-types";
import TableIconButton from "$lib/components/TableIconButton.svelte";
import TableRowActions from "$lib/components/TableRowActions.svelte";
import TruncatedText from "$lib/components/TruncatedText.svelte";
import { Badge } from "$lib/components/ui/badge/index.js";
import { Spinner } from "$lib/components/ui/spinner/index.js";
import * as Table from "$lib/components/ui/table/index.js";
import WorkspaceTaskEmptyState from "./WorkspaceTaskEmptyState.svelte";

type HomeworkDateFormatter = (
  value: Date | string | null | undefined,
) => string;
type HomeworkOverduePredicate = (
  value: Date | string | null | undefined,
) => boolean;
type HomeworkAction = (homework: WorkspaceHomeworkItem) => string;

export let filteredHomeworkItems: WorkspaceHomeworkItem[];
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
export let selectedHomework: WorkspaceHomeworkItem | null;
export let toggleHomeworkCompletion: (
  homework: WorkspaceHomeworkItem,
) => void | Promise<void>;

function summaryBadges(homework: WorkspaceHomeworkItem) {
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

<Table.Root class="min-w-0 w-full" data-testid="workspace-homeworks-list">
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
            {#if !homework.completion}
              <Badge
                variant={homeworkIsOverdue(homework.submissionDueAt)
                  ? "destructive"
                  : "ghost"}
              >
                {homeworkEtaLabel(homework.submissionDueAt)}
              </Badge>
            {/if}
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
      <Table.Row class="hover:bg-transparent">
        <Table.Cell class="p-0" colspan={5}>
          <WorkspaceTaskEmptyState
            title={homeworksCopy.filterEmptyTitle}
            description={hasHomeworkItems ? homeworksCopy.filterEmptyDescription : undefined}
            clearFilterLabel={homeworksCopy.clearFilter}
            onClearFilter={hasHomeworkItems ? onClearFilter : undefined}
          />
        </Table.Cell>
      </Table.Row>
    {/each}
  </Table.Body>
</Table.Root>
