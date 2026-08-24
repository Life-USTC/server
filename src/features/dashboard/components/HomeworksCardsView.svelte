<script lang="ts">
import ArrowUpRight from "@lucide/svelte/icons/arrow-up-right";
import CheckCircleIcon from "@lucide/svelte/icons/check-circle";
import LoaderCircle from "@lucide/svelte/icons/loader-circle";
import RefreshCw from "@lucide/svelte/icons/refresh-cw";
import type { DashboardHomeworkItem } from "@/features/dashboard/lib/dashboard-controller-types";
import { Badge } from "$lib/components/ui/badge/index.js";
import { Button } from "$lib/components/ui/button/index.js";
import * as Empty from "$lib/components/ui/empty/index.js";
import * as Item from "$lib/components/ui/item/index.js";
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
</script>

<div class="min-w-0" data-testid="dashboard-homeworks-cards">
  {#if filteredHomeworkItems.length > 0}
    <Item.Group class="gap-0">
      {#each filteredHomeworkItems as homework, index (homework.id)}
        <Item.Root
          class="items-start px-2 py-2"
          id={`homework-${homework.id}`}
          size="sm"
        >
          <Item.Content class="min-w-0 gap-0.5">
            <Item.Title class="block min-w-0 max-w-full">
              <button
                class="block min-w-0 max-w-full truncate text-left underline-offset-4 hover:underline"
                type="button"
                onclick={() => {
                  selectedHomework = homework;
                }}
              >
                {homework.title}
              </button>
            </Item.Title>
            <Item.Description class="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5">
              <a class="max-w-full truncate hover:underline" href={homeworkSectionHref(homework)}>
                {homework.section?.courseName ?? homeworkCopy.section}
              </a>
              <span aria-hidden="true">·</span>
              <span class="truncate">{homeworkCopy.due}: {fmtDate(homework.submissionDueAt)}</span>
              <Badge variant={homeworkIsOverdue(homework.submissionDueAt) ? "destructive" : "ghost"}>
                {homeworkEtaLabel(homework.submissionDueAt)}
              </Badge>
              {#if homework.completion}
                <Badge variant="secondary">{homeworksCopy.completedLabel}</Badge>
              {/if}
              {#if homework.isMajor}
                <Badge variant="secondary">{homeworksCopy.tagMajor}</Badge>
              {/if}
              {#if homework.requiresTeam}
                <Badge variant="outline">{homeworksCopy.tagTeam}</Badge>
              {/if}
            </Item.Description>
          </Item.Content>
          <Item.Actions class="shrink-0 self-start">
            <DashboardTableIconButton
              label={homeworksCopy.viewDetails}
              onclick={() => {
                selectedHomework = homework;
              }}
            >
              <ArrowUpRight />
            </DashboardTableIconButton>
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
