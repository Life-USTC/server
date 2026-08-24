<script lang="ts">
import CheckCircleIcon from "@lucide/svelte/icons/check-circle";
import LoaderCircle from "@lucide/svelte/icons/loader-circle";
import RefreshCw from "@lucide/svelte/icons/refresh-cw";
import type { DashboardHomeworkItem } from "@/features/dashboard/lib/dashboard-controller-types";
import TruncatedText from "$lib/components/TruncatedText.svelte";
import { Badge } from "$lib/components/ui/badge/index.js";
import { Button } from "$lib/components/ui/button/index.js";
import * as Empty from "$lib/components/ui/empty/index.js";
import * as Table from "$lib/components/ui/table/index.js";
import DashboardTableIconButton from "./DashboardTableIconButton.svelte";
import DashboardTableRowActions from "./DashboardTableRowActions.svelte";

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
            class="block min-w-0 max-w-full overflow-hidden text-left hover:underline"
            type="button"
            onclick={() => {
              selectedHomework = homework;
            }}
          >
            <TruncatedText text={homework.title} />
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
          <DashboardTableRowActions>
            <DashboardTableIconButton
              disabled={homeworkSavingById[homework.id]}
              label={homeworkSavingById[homework.id]
                ? homeworksCopy.saving
                : homeworkCompletionActionLabel(homework)}
              onclick={() => toggleHomeworkCompletion(homework)}
            >
              {#if homeworkSavingById[homework.id]}
                <LoaderCircle class="animate-spin" />
              {:else if homework.completion}
                <RefreshCw />
              {:else}
                <CheckCircleIcon />
              {/if}
            </DashboardTableIconButton>
          </DashboardTableRowActions>
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
