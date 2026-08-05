<script lang="ts">
import SoftEmptyMessage from "$lib/components/SoftEmptyMessage.svelte";
import { Badge } from "$lib/components/ui/badge/index.js";
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
    <SoftEmptyMessage message={sectionCopy.noHomework} />
  {:else}
    <div class="min-w-0 overflow-x-auto">
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
                  class="text-left hover:underline"
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
