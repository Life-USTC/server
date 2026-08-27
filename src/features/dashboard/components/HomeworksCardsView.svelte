<script lang="ts">
import ArrowUpRight from "@lucide/svelte/icons/arrow-up-right";
import CheckCircleIcon from "@lucide/svelte/icons/check-circle";
import RefreshCw from "@lucide/svelte/icons/refresh-cw";
import type { DashboardHomeworkItem } from "@/features/dashboard/lib/dashboard-controller-types";
import { homeworkSummaryBadges } from "@/features/homeworks/lib/homework-presentation";
import { Badge } from "$lib/components/ui/badge/index.js";
import { Button } from "$lib/components/ui/button/index.js";
import * as Empty from "$lib/components/ui/empty/index.js";
import * as Item from "$lib/components/ui/item/index.js";
import { Spinner } from "$lib/components/ui/spinner/index.js";
import DashboardTableIconButton from "./DashboardTableIconButton.svelte";

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

<div class="min-w-0" data-testid="dashboard-homeworks-cards">
  {#if filteredHomeworkItems.length > 0}
    <Item.Group class="gap-0">
      {#each filteredHomeworkItems as homework, index (homework.id)}
        <Item.Root
          class="items-start gap-3 px-2 py-3"
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
              class="line-clamp-none flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 break-words"
            >
              <a
                class="max-w-full break-words hover:underline"
                href={homeworkSectionHref(homework)}
              >
                {homework.section?.courseName ?? homeworkCopy.section}
              </a>
              <span aria-hidden="true">·</span>
              <span class="max-w-full break-words"
                >{homeworkCopy.due}: {fmtDate(homework.submissionDueAt)}</span
              >
              <Badge variant={homeworkIsOverdue(homework.submissionDueAt) ? "destructive" : "ghost"}>
                {homeworkEtaLabel(homework.submissionDueAt)}
              </Badge>
              {#each summaryBadges(homework) as badge (badge.key)}
                <Badge variant={badge.variant}>{badge.label}</Badge>
              {/each}
            </Item.Description>
          </Item.Content>
          <Item.Actions class="shrink-0 self-start">
            <DashboardTableIconButton
              className="size-11"
              disabled={homeworkSavingById[homework.id]}
              label={homeworkSavingById[homework.id]
                ? homeworksCopy.saving
                : homeworkCompletionActionLabel(homework)}
              variant={homework.completion ? "secondary" : "default"}
              onclick={() => toggleHomeworkCompletion(homework)}
            >
              {#if homeworkSavingById[homework.id]}
                <Spinner />
              {:else if homework.completion}
                <RefreshCw />
              {:else}
                <CheckCircleIcon />
              {/if}
            </DashboardTableIconButton>
            <DashboardTableIconButton
              className="size-11"
              label={homeworksCopy.viewDetails}
              variant="outline"
              onclick={() => {
                selectedHomework = homework;
              }}
            >
              <ArrowUpRight />
            </DashboardTableIconButton>
          </Item.Actions>
        </Item.Root>
        {#if index < filteredHomeworkItems.length - 1}
          <Item.Separator class="my-0" />
        {/if}
      {/each}
    </Item.Group>
  {:else}
    <Empty.Root class="min-h-24 items-start text-left">
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
  {/if}
</div>
