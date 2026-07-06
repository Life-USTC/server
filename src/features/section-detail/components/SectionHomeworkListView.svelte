<script lang="ts">
import { Badge } from "$lib/components/ui/badge/index.js";
import { Button } from "$lib/components/ui/button/index.js";
import * as Empty from "$lib/components/ui/empty/index.js";
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
            <Button
              class="h-auto whitespace-normal text-left"
              type="button"
              variant="link"
              onclick={() => {
                selectHomework(homework);
              }}
            >
              {homework.title}
            </Button>
          </Table.Cell>
          <Table.Cell>{fmtDateTime(homework.submissionDueAt)}</Table.Cell>
          <Table.Cell>
            <div class="flex gap-2">
              {#if homework.isMajor}<Badge variant="secondary">{homeworkCopy.tagMajor}</Badge>{/if}
              {#if homework.requiresTeam}<Badge variant="secondary">{homeworkCopy.tagTeam}</Badge>{/if}
            </div>
          </Table.Cell>
        </Table.Row>
      {:else}
        <Table.Row>
          <Table.Cell class="p-0" colspan={3}>
            <Empty.Root class="py-6">
              <Empty.Header>
                <Empty.Description>{sectionCopy.noHomework}</Empty.Description>
              </Empty.Header>
            </Empty.Root>
          </Table.Cell>
        </Table.Row>
      {/each}
    </Table.Body>
  </Table.Root>
</div>
