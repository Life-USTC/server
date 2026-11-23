<script lang="ts">
import { onMount } from "svelte";
import RecordCollection from "#lib/components/RecordCollection.svelte";
import CollectionEmpty from "#lib/components/CollectionEmpty.svelte";
import { Badge } from "#lib/components/ui/badge/index.js";
import { Button } from "#lib/components/ui/button/index.js";
import HomeworkPersonalStatus from "@/features/homeworks/components/HomeworkPersonalStatus.svelte";
import {
  formatHomeworkDueRelativeTime,
  homeworkDeadlineState,
} from "@/features/homeworks/lib/homework-presentation";
import type {
  SectionCopy,
  SectionHomework,
  SectionHomeworkCopy,
} from "./section-homework-tab-types";

export let fmtDateTime: (value: string | Date | null | undefined) => string;
export let homeworkCopy: SectionHomeworkCopy;
export let homeworks: SectionHomework[];
export let locale: string;
export let showPersonalStatus = false;
export let sectionCopy: SectionCopy;
export let selectHomework: (homework: SectionHomework) => void | Promise<void>;
let referenceDate = new Date();
onMount(() => {
  const timer = window.setInterval(() => (referenceDate = new Date()), 60_000);
  return () => window.clearInterval(timer);
});
</script>

{#snippet personalStatus(homework: SectionHomework)}
  <div role="group" aria-label={homeworkCopy.myStatus} class="inline-flex flex-wrap items-center gap-2">
    <HomeworkPersonalStatus
      completed={Boolean(homework.completion)}
      completionRequired={homework.completionRequired !== false}
      copy={homeworkCopy}
      relativeLabel={homework.submissionDueAt ? formatHomeworkDueRelativeTime(homework.submissionDueAt, referenceDate, locale, homeworkCopy.dateTBD) : ""}
      overdue={homeworkDeadlineState(homework.submissionDueAt, referenceDate) === "overdue"}
    />
    <Button size="sm" variant="link" onclick={() => selectHomework(homework)}>{homeworkCopy.viewDetails}</Button>
  </div>
{/snippet}

{#snippet title(homework: SectionHomework)}
  <button class="min-h-11 min-w-11 text-left break-words hover:underline" type="button" onclick={() => selectHomework(homework)}>
    {homework.title}
  </button>
{/snippet}

{#snippet flags(homework: SectionHomework)}
  <span class="inline-flex flex-wrap gap-2">
    {#if !showPersonalStatus && homework.completionRequired === false}<Badge variant="outline">{homeworkCopy.noCompletionRequired}</Badge>{/if}
    {#if homework.isMajor}<Badge variant="outline">{homeworkCopy.tagMajor}</Badge>{/if}
    {#if homework.requiresTeam}<Badge variant="outline">{homeworkCopy.tagTeam}</Badge>{/if}
  </span>
{/snippet}

<div data-testid="section-homeworks-list">
  {#if homeworks.length === 0}
    <CollectionEmpty variant="compact" description={sectionCopy.noHomework} />
  {:else}
    <RecordCollection rows={homeworks} rowKey={(homework) => homework.id}
      {title} titleText={(homework) => homework.title} titleLabel={sectionCopy.title}
      cardsTestId="section-homeworks-items"
      fields={[
        { label: sectionCopy.due, text: (homework) => fmtDateTime(homework.submissionDueAt) },
        { label: sectionCopy.flags, content: flags },
        ...(showPersonalStatus ? [{ label: homeworkCopy.myStatus, content: personalStatus }] : []),
      ]}
    />
  {/if}
</div>
