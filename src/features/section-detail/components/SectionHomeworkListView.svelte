<script lang="ts">
import { Badge } from "$lib/components/ui/badge/index.js";
import * as Empty from "$lib/components/ui/empty/index.js";
import * as Item from "$lib/components/ui/item/index.js";
import * as Table from "$lib/components/ui/table/index.js";
import type {
  SectionCopy,
  SectionHomework,
  SectionHomeworkCopy,
} from "./section-homework-tab-types";

export let fmtDateTime: (value: string | Date | null | undefined) => string;
export let homeworkCopy: SectionHomeworkCopy;
export let homeworks: SectionHomework[];
export let sectionCopy: SectionCopy;
export let selectHomework: (homework: SectionHomework) => void;
</script>

<div data-testid="section-homeworks-list">
  {#if homeworks.length === 0}
    <Empty.Root class="min-h-20 border-0 px-2 py-6">
      <Empty.Header>
        <Empty.Description>{sectionCopy.noHomework}</Empty.Description>
      </Empty.Header>
    </Empty.Root>
  {:else}
    <div class="md:hidden" data-testid="section-homeworks-items">
      <Item.Group class="gap-0">
        {#each homeworks as homework, index (homework.id)}
          <Item.Root class="items-start gap-3 px-2 py-3">
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
                {#if homework.isMajor}
                  <Badge variant="secondary">{homeworkCopy.tagMajor}</Badge>
                {/if}
                {#if homework.requiresTeam}
                  <Badge variant="secondary">{homeworkCopy.tagTeam}</Badge>
                {/if}
              </Item.Description>
            </Item.Content>
          </Item.Root>
          {#if index < homeworks.length - 1}
            <Item.Separator class="my-0" />
          {/if}
        {/each}
      </Item.Group>
    </div>
    <div class="hidden min-w-0 md:block">
      <Table.Root>
        <Table.Header>
          <Table.Row>
            <Table.Head>{sectionCopy.title}</Table.Head>
            <Table.Head>{sectionCopy.due}</Table.Head>
            <Table.Head>{sectionCopy.flags}</Table.Head>
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
                  {#if homework.isMajor}<Badge variant="secondary"
                      >{homeworkCopy.tagMajor}</Badge
                    >{/if}
                  {#if homework.requiresTeam}<Badge variant="secondary"
                      >{homeworkCopy.tagTeam}</Badge
                    >{/if}
                </div>
              </Table.Cell>
            </Table.Row>
          {/each}
        </Table.Body>
      </Table.Root>
    </div>
  {/if}
</div>
