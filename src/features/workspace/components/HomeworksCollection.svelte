<script lang="ts">
import ArrowUpRight from "@lucide/svelte/icons/arrow-up-right";
import CheckCircleIcon from "@lucide/svelte/icons/check-circle";
import RefreshCw from "@lucide/svelte/icons/refresh-cw";
import MobileListCard from "#lib/components/MobileListCard.svelte";
import ResponsiveCollection from "#lib/components/ResponsiveCollection.svelte";
import TableIconButton from "#lib/components/TableIconButton.svelte";
import TableRowActions from "#lib/components/TableRowActions.svelte";
import TruncatedText from "#lib/components/TruncatedText.svelte";
import { Badge } from "#lib/components/ui/badge/index.js";
import * as Item from "#lib/components/ui/item/index.js";
import { Spinner } from "#lib/components/ui/spinner/index.js";
import * as Table from "#lib/components/ui/table/index.js";
import HomeworkPersonalStatus from "@/features/homeworks/components/HomeworkPersonalStatus.svelte";
import { homeworkSummaryBadges } from "@/features/homeworks/lib/homework-presentation";
import type {
  WorkspaceHomeworkItem,
  WorkspaceHomeworksCopy,
} from "@/features/workspace/lib/workspace-controller-types";
import { formatSemesterName } from "@/lib/text/format-semester-name";
import WorkspaceTaskEmptyState from "./WorkspaceTaskEmptyState.svelte";

type HomeworkDateFormatter = (
  value: Date | string | null | undefined,
) => string;
type HomeworkOverduePredicate = (
  value: Date | string | null | undefined,
) => boolean;
type HomeworkAction = (homework: WorkspaceHomeworkItem) => string;

export let showPersonalStatus = false;
export let readOnlyReason: string | null | undefined = null;
export let locale: string;
export let unknownSemesterLabel: string;
export let filteredHomeworkItems: WorkspaceHomeworkItem[];
export let hasHomeworkItems: boolean;
export let showClearFilter = false;
export let onClearFilter: () => void;
export let fmtDate: HomeworkDateFormatter;
export let homeworkCompletionActionLabel: HomeworkAction;
export let homeworkCopy: Record<string, string>;
export let homeworkEtaLabel: HomeworkDateFormatter;
export let homeworkIsOverdue: HomeworkOverduePredicate;
export let homeworkSectionHref: HomeworkAction;
export let homeworksCopy: WorkspaceHomeworksCopy;
export let homeworkSavingById: Record<string, boolean>;
export let selectedHomework: WorkspaceHomeworkItem | null;
export let toggleHomeworkCompletion: (
  homework: WorkspaceHomeworkItem,
) => void | Promise<void>;

function propertyBadges(homework: WorkspaceHomeworkItem) {
  return homeworkSummaryBadges(
    {
      completed: false,
      completionRequired: homework.completionRequired,
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

{#snippet actions(homework: WorkspaceHomeworkItem)}
  {#if homework.completionRequired !== false}
    <TableIconButton
      disabled={Boolean(readOnlyReason) || homeworkSavingById[homework.id]}
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
  {/if}
  <TableIconButton
    label={homeworksCopy.viewDetails}
    variant="outline"
    onclick={() => {
      selectedHomework = homework;
    }}
  >
    <ArrowUpRight data-icon="inline-start" />
  </TableIconButton>
{/snippet}

{#snippet emptyState()}
  <WorkspaceTaskEmptyState
    title={hasHomeworkItems ? homeworksCopy.filterEmptyTitle : homeworksCopy.emptyTitle}
    description={hasHomeworkItems
      ? homeworksCopy.filterEmptyDescription
      : homeworksCopy.emptyDescription}
    clearFilterLabel={homeworksCopy.clearFilter}
    onClearFilter={showClearFilter ? onClearFilter : undefined}
  />
{/snippet}

{#snippet personalStatus(homework: WorkspaceHomeworkItem)}
  <HomeworkPersonalStatus completed={Boolean(homework.completion)} completionRequired={homework.completionRequired !== false} copy={homeworksCopy} relativeLabel={homework.submissionDueAt ? homeworkEtaLabel(homework.submissionDueAt) : ""} overdue={homeworkIsOverdue(homework.submissionDueAt)} />
{/snippet}

<ResponsiveCollection workspace>
  {#snippet mobile()}
    <div class="min-w-0" data-testid="workspace-homeworks-cards">
      {#if filteredHomeworkItems.length > 0}
        <Item.Group class="gap-0">
          {#each filteredHomeworkItems as homework, index (homework.id)}
            <MobileListCard

              id={`homework-${homework.id}`}
            >
              <Item.Content class="min-w-0 gap-1">
                <Item.Title class="line-clamp-none w-full min-w-0">
                  <button
                    class="flex min-h-11 w-full min-w-0 max-w-full items-center text-left underline-offset-4 hover:underline"
                    type="button"
                    onclick={() => {
                      selectedHomework = homework;
                    }}
                  >
                    <span class="line-clamp-2 min-w-0 max-w-full break-words">
                      {homework.title}
                    </span>
                  </button>
                </Item.Title>
                <Item.Description
                  class="line-clamp-none grid min-w-0 gap-1 break-words"
                >
                  <a
                    class="max-w-full break-words hover:underline"
                    href={homeworkSectionHref(homework)}
                  >
                    {homework.section?.courseName ?? homeworkCopy.section}
                  </a>
                  <span class="max-w-full break-words">{formatSemesterName(locale, homework.section?.semesterName ?? unknownSemesterLabel)}</span>
                  <span class="max-w-full break-words"
                    >{homeworkCopy.due}: {fmtDate(homework.submissionDueAt)}</span
                  >
                  {#if homework.isMajor || homework.requiresTeam}<span class="flex min-w-0 flex-wrap gap-2">
                    {#each propertyBadges(homework) as badge (badge.key)}<Badge variant={badge.variant}>{badge.label}</Badge>{/each}
                  </span>{/if}
                </Item.Description>
                {#if showPersonalStatus}
                <div class="grid min-w-0 gap-1" role="group" aria-label={homeworksCopy.myStatus}>
                  <span class="text-sm text-muted-foreground">{homeworksCopy.myStatus}</span>
                  {@render personalStatus(homework)}
                </div>
                {/if}
              </Item.Content>
              <Item.Actions class="shrink-0 self-start">
                {@render actions(homework)}
              </Item.Actions>
            </MobileListCard>
            {#if index < filteredHomeworkItems.length - 1}
              <Item.Separator class="my-0" />
            {/if}
          {/each}
        </Item.Group>
      {:else}
        {@render emptyState()}
      {/if}
    </div>
  {/snippet}
  {#snippet desktop()}
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
              <span class="block text-muted-foreground text-sm">{formatSemesterName(locale, homework.section?.semesterName ?? unknownSemesterLabel)}</span>
            </Table.Cell>
            <Table.Cell>
              <button
                class="block min-h-11 min-w-0 max-w-full text-left font-medium hover:underline"
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
              <div class="grid min-w-0 gap-1">
                {#if showPersonalStatus}<div role="group" aria-label={homeworksCopy.myStatus}>{@render personalStatus(homework)}</div>{/if}
              {#if homework.isMajor || homework.requiresTeam}<div class="flex min-w-0 flex-wrap items-center gap-1.5">
                {#each propertyBadges(homework) as badge (badge.key)}
                  <Badge variant={badge.variant}>{badge.label}</Badge>
                {/each}
              </div>{/if}
              </div>
            </Table.Cell>
            <Table.Cell>
              <TableRowActions>
                {@render actions(homework)}
              </TableRowActions>
            </Table.Cell>
          </Table.Row>
        {:else}
          <Table.Row class="hover:bg-transparent">
            <Table.Cell class="p-0" colspan={5}>
              {@render emptyState()}
            </Table.Cell>
          </Table.Row>
        {/each}
      </Table.Body>
    </Table.Root>
  {/snippet}
</ResponsiveCollection>
