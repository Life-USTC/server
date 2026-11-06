<script lang="ts">
import { Badge } from "#lib/components/ui/badge/index.js";
import * as Table from "#lib/components/ui/table/index.js";
import type {
  HomeworkDateValue,
  HomeworkDetailModel,
} from "@/features/homeworks/lib/homework-presentation";
import HomeworkPersonalStatus from "./HomeworkPersonalStatus.svelte";
import type {
  HomeworkDetailCopy,
  HomeworkDetailDateFormatter,
} from "./homework-detail-types";

export let showPersonalStatus = false;
export let copy: HomeworkDetailCopy;
export let fmtDate: HomeworkDetailDateFormatter;
export let homework: HomeworkDetailModel;

$: flagLabels = [
  homework.isMajor ? copy.tagMajor : null,
  homework.requiresTeam ? copy.tagTeam : null,
].filter((label): label is string => Boolean(label));

function displayDate(value: HomeworkDateValue) {
  return fmtDate(value);
}
</script>

<section class="min-w-0" data-testid="homework-secondary-details">
  <Table.Root>
    <Table.Body>
      {#if showPersonalStatus || flagLabels.length > 0}
      <Table.Row>
        <Table.Head
          class="text-muted-foreground h-auto w-[38%] px-0 py-2"
          scope="row"
        >
          {copy.statusLabel}
        </Table.Head>
        <Table.Cell class="h-auto px-0 py-2">
          <div class="grid min-w-0 gap-1">
            {#if showPersonalStatus}
              <HomeworkPersonalStatus completed={homework.completed} completionRequired={homework.completionRequired} {copy} />
            {/if}
            {#if flagLabels.length > 0}<div class="flex min-w-0 flex-wrap gap-2">{#each flagLabels as label}<Badge variant="outline">{label}</Badge>{/each}</div>{/if}
          </div>
        </Table.Cell>
      </Table.Row>
      {/if}
      <Table.Row>
        <Table.Head
          class="text-muted-foreground h-auto px-0 py-2"
          scope="row"
        >
          {copy.submissionStart}
        </Table.Head>
        <Table.Cell class="h-auto px-0 py-2">
          {displayDate(homework.submissionStartAt)}
        </Table.Cell>
      </Table.Row>
      <Table.Row>
        <Table.Head
          class="text-muted-foreground h-auto px-0 py-2"
          scope="row"
        >
          {copy.publishedAt}
        </Table.Head>
        <Table.Cell class="h-auto px-0 py-2">
          {displayDate(homework.publishedAt)}
        </Table.Cell>
      </Table.Row>
    </Table.Body>
  </Table.Root>
</section>
