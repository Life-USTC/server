<script lang="ts">
import { onMount } from "svelte";
import CollectionEmpty from "#lib/components/CollectionEmpty.svelte";
import MobileListCard from "#lib/components/MobileListCard.svelte";
import ResponsiveCollection from "#lib/components/ResponsiveCollection.svelte";
import { Badge } from "#lib/components/ui/badge/index.js";
import { Button } from "#lib/components/ui/button/index.js";
import * as Item from "#lib/components/ui/item/index.js";
import * as Table from "#lib/components/ui/table/index.js";
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
  <div class="flex min-w-0 flex-wrap items-center gap-2">
    {#if homework.completionRequired === false}
      <Badge variant="outline">{homeworkCopy.noCompletionRequired}</Badge>
    {:else if homework.completion}
      <Badge variant="secondary">{homeworkCopy.completedLabel}</Badge>
    {:else}
      <Badge variant="outline">{homeworkCopy.pendingLabel}</Badge>
      {#if homework.submissionDueAt}
        {@const overdue = homeworkDeadlineState(homework.submissionDueAt, referenceDate) === "overdue"}
        <Badge variant={overdue ? "status-overdue" : "ghost"} data-status-token={overdue ? "overdue" : undefined}>
          {formatHomeworkDueRelativeTime(homework.submissionDueAt, referenceDate, locale, homeworkCopy.dateTBD)}
        </Badge>
      {/if}
    {/if}
    <Button size="sm" variant="link" onclick={() => selectHomework(homework)}>{homeworkCopy.viewDetails}</Button>
  </div>
{/snippet}

<div data-testid="section-homeworks-list">
  {#if homeworks.length === 0}
    <CollectionEmpty variant="compact" description={sectionCopy.noHomework} />
  {:else}
    <ResponsiveCollection>
      {#snippet mobile()}
        <div data-testid="section-homeworks-items">
          <Item.Group class="gap-0">
            {#each homeworks as homework, index (homework.id)}
              <MobileListCard>
                <Item.Content class="min-w-0 gap-1">
                  <Item.Title class="line-clamp-none w-full min-w-0">
                    <button
                      class="flex min-h-11 w-full min-w-0 max-w-full items-center text-left hover:underline"
                      type="button"
                      onclick={() => {
                        selectHomework(homework);
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
                    <span class="max-w-full break-words">
                      {sectionCopy.due}: {fmtDateTime(homework.submissionDueAt)}
                    </span>
                    {#if !showPersonalStatus && homework.completionRequired === false}
                      <Badge variant="outline">{homeworkCopy.noCompletionRequired}</Badge>
                    {/if}
                    {#if homework.isMajor}
                      <Badge variant="secondary">{homeworkCopy.tagMajor}</Badge>
                    {/if}
                    {#if homework.requiresTeam}
                      <Badge variant="secondary">{homeworkCopy.tagTeam}</Badge>
                    {/if}
                  </Item.Description>
                  {#if showPersonalStatus}
                    <div class="grid min-w-0 gap-1" role="group" aria-label={homeworkCopy.myStatus}>
                      <span class="text-sm text-muted-foreground">{homeworkCopy.myStatus}</span>
                      {@render personalStatus(homework)}
                    </div>
                  {/if}
                </Item.Content>
              </MobileListCard>
              {#if index < homeworks.length - 1}
                <Item.Separator class="my-0" />
              {/if}
            {/each}
          </Item.Group>
        </div>
      {/snippet}
      {#snippet desktop()}
        <div class="min-w-0">
          <Table.Root>
            <Table.Header>
              <Table.Row>
                <Table.Head>{sectionCopy.title}</Table.Head>
                <Table.Head>{sectionCopy.due}</Table.Head>
                <Table.Head>{sectionCopy.flags}</Table.Head>
                {#if showPersonalStatus}<Table.Head>{homeworkCopy.myStatus}</Table.Head>{/if}
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {#each homeworks as homework}
                <Table.Row>
                  <Table.Cell>
                    <button
                      class="min-h-11 max-w-full text-left break-words hover:underline"
                      type="button"
                      onclick={() => {
                        selectHomework(homework);
                      }}
                    >
                      {homework.title}
                    </button>
                  </Table.Cell>
                  <Table.Cell
                    >{fmtDateTime(homework.submissionDueAt)}</Table.Cell
                  >
                  <Table.Cell>
                    <div class="flex min-w-0 flex-wrap gap-2">
                      {#if !showPersonalStatus && homework.completionRequired === false}
                        <Badge variant="outline">{homeworkCopy.noCompletionRequired}</Badge>
                      {/if}
                      {#if homework.isMajor}<Badge variant="secondary"
                          >{homeworkCopy.tagMajor}</Badge
                        >{/if}
                      {#if homework.requiresTeam}<Badge variant="secondary"
                          >{homeworkCopy.tagTeam}</Badge
                        >{/if}
                    </div>
                  </Table.Cell>
                  {#if showPersonalStatus}
                    <Table.Cell><div role="group" aria-label={homeworkCopy.myStatus}>{@render personalStatus(homework)}</div></Table.Cell>
                  {/if}
                </Table.Row>
              {/each}
            </Table.Body>
          </Table.Root>
        </div>
      {/snippet}
    </ResponsiveCollection>
  {/if}
</div>
