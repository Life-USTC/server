<script lang="ts">
import CheckCircleIcon from "@lucide/svelte/icons/check-circle";
import LoaderCircle from "@lucide/svelte/icons/loader-circle";
import RefreshCw from "@lucide/svelte/icons/refresh-cw";
import type { DashboardHomeworkItem } from "@/features/dashboard/lib/dashboard-controller-types";
import { Badge } from "$lib/components/ui/badge/index.js";
import { Button } from "$lib/components/ui/button/index.js";
import * as Card from "$lib/components/ui/card/index.js";
import * as Empty from "$lib/components/ui/empty/index.js";
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

<div class="grid gap-3 md:grid-cols-2" data-testid="dashboard-homeworks-cards">
  {#each filteredHomeworkItems as homework}
    <Card.Root
      class="group"
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
          <a class="hover:underline" href={homeworkSectionHref(homework)}
            >{homework.section?.courseName ?? homeworkCopy.section}</a
          >
          · {homeworkCopy.due}:
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
          <Badge variant={homeworkIsOverdue(homework.submissionDueAt) ? "destructive" : "ghost"}>{homeworkEtaLabel(homework.submissionDueAt)}</Badge>
          {#if homework.isMajor}<Badge variant="secondary">{homeworksCopy.tagMajor}</Badge>{/if}
          {#if homework.requiresTeam}<Badge variant="secondary">{homeworksCopy.tagTeam}</Badge>{/if}
        </div>
      </Card.Content>
      <Card.Footer class="justify-end">
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
      </Card.Footer>
    </Card.Root>
  {:else}
    <Empty.Root class="min-h-24 items-start text-left md:col-span-2">
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
  {/each}
</div>
