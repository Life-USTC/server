<script lang="ts">
import { Alert } from "$lib/components/ui/alert/index.js";
import { Badge } from "$lib/components/ui/badge/index.js";
import type {
  SectionCopy,
  SectionHomework,
  SectionHomeworkCopy,
} from "./section-homework-tab-types";

export let fmtDateTime: (value: string | Date | null | undefined) => string;
export let homeworkCopy: SectionHomeworkCopy;
export let homeworkStatus: (homework: SectionHomework) => string;
export let homeworks: SectionHomework[];
export let sectionCopy: SectionCopy;
export let selectHomework: (homework: SectionHomework) => void;
</script>

<div class="grid gap-3" data-testid="section-homeworks-cards">
  {#each homeworks as homework}
    <button
      class="rounded-lg border border-base-300 p-4 text-left transition hover:border-primary"
      id={`homework-${homework.id}`}
      type="button"
      onclick={() => {
        selectHomework(homework);
      }}
    >
      <span class="flex flex-wrap items-start justify-between gap-2">
        <span class="font-semibold">{homework.title}</span>
        <span class="flex gap-2">
          {#if homework.isMajor}<Badge variant="secondary">{homeworkCopy.tagMajor}</Badge>{/if}
          {#if homework.requiresTeam}<Badge variant="secondary">{homeworkCopy.tagTeam}</Badge>{/if}
          <Badge>{homeworkStatus(homework)}</Badge>
        </span>
      </span>
      <span class="mt-1 block text-base-content/60 text-sm">
        {sectionCopy.due} {fmtDateTime(homework.submissionDueAt)}
      </span>
      {#if homework.description?.content}
        <span class="mt-3 block whitespace-pre-wrap text-sm">{homework.description.content}</span>
      {/if}
    </button>
  {:else}
    <Alert>{sectionCopy.noHomework}</Alert>
  {/each}
</div>
