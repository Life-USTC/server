<script lang="ts">
import type {
  HomeworkDateValue,
  HomeworkDetailModel,
} from "@/features/homeworks/lib/homework-presentation";
import * as Table from "$lib/components/ui/table/index.js";
import type {
  HomeworkDetailCopy,
  HomeworkDetailDateFormatter,
} from "./homework-detail-types";

export let copy: HomeworkDetailCopy;
export let fmtDate: HomeworkDetailDateFormatter;
export let homework: HomeworkDetailModel;

$: flagLabels = [
  homework.isMajor ? copy.tagMajor : null,
  homework.requiresTeam ? copy.tagTeam : null,
].filter((label): label is string => Boolean(label));
$: statusValue = [homework.completed ? copy.completedLabel : copy.pendingLabel]
  .concat(flagLabels)
  .join(" · ");

function displayDate(value: HomeworkDateValue) {
  return fmtDate(value);
}
</script>

<section class="min-w-0" data-testid="homework-secondary-details">
  <Table.Root>
    <Table.Body>
      <Table.Row>
        <Table.Head
          class="text-muted-foreground h-auto w-[38%] px-0 py-2"
          scope="row"
        >
          {copy.statusLabel}
        </Table.Head>
        <Table.Cell class="h-auto px-0 py-2">{statusValue}</Table.Cell>
      </Table.Row>
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
