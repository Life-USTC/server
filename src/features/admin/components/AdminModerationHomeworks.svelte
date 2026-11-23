<script lang="ts">
import Trash2 from "@lucide/svelte/icons/trash-2";
import CollectionEmpty from "#lib/components/CollectionEmpty.svelte";
import CollectionTableShell from "#lib/components/CollectionTableShell.svelte";
import TableControlsRow from "#lib/components/TableControlsRow.svelte";
import TableIconButton from "#lib/components/TableIconButton.svelte";
import TableRowActions from "#lib/components/TableRowActions.svelte";
import TruncatedText from "#lib/components/TruncatedText.svelte";
import { Badge } from "#lib/components/ui/badge/index.js";
import * as Table from "#lib/components/ui/table/index.js";
import type {
  AdminModerationFilterControls,
  AdminModerationHomework,
} from "./admin-moderation-page-types";

type HomeworksCopy = {
  actions: string;
  author: string;
  createdAt: string;
  deleteHomeworkAction: string;
  homeworkDue: string;
  homeworkSection: string;
  homeworkStatusActive: string;
  homeworkStatusDeleted: string;
  homeworkTitle: string;
  noHomeworks: string;
  notAvailable: string;
  status: string;
};

export let filterControls: AdminModerationFilterControls;
export let copy: HomeworksCopy;
export let formatDate: (value: string | Date) => string;
export let homeworks: AdminModerationHomework[];
export let onDelete: (homework: AdminModerationHomework) => void;

function creatorLabel(homework: AdminModerationHomework) {
  return (
    homework.createdBy?.name ??
    homework.createdBy?.username ??
    copy.notAvailable
  );
}
</script>

<section class="grid gap-3">
  <CollectionTableShell cards label={copy.homeworkTitle}>
    <Table.Root class="w-full min-w-[62rem]">
      <Table.Header>
        <TableControlsRow colspan={6}>{@render filterControls("search")}</TableControlsRow>
        <Table.Row>
          <Table.Head class="w-[28%]">{@render filterControls("content")}</Table.Head>
          <Table.Head class="w-[22%]">{@render filterControls("target")}</Table.Head>
          <Table.Head class="w-[16%]">{@render filterControls("createdAt")}</Table.Head>
          <Table.Head class="w-[16%]">{@render filterControls("dueAt")}</Table.Head>
          <Table.Head class="w-[12%]">{@render filterControls("status")}</Table.Head>
          <Table.Head class="w-14 min-w-14">
            <span class="sr-only">{copy.actions}</span>
          </Table.Head>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {#each homeworks as homework}
          <Table.Row class="group">
            <Table.Cell data-label={copy.homeworkTitle} class="max-w-0">
              <TruncatedText class="font-medium" text={homework.title} />
              <TruncatedText class="text-muted-foreground text-xs" text={`${copy.author}: ${creatorLabel(homework)}`} />
            </Table.Cell>
            <Table.Cell data-label={copy.homeworkSection} class="max-w-0">
              <div class="grid min-w-0 gap-0.5">
                <TruncatedText text={homework.section.course.nameCn} />
                <span class="font-mono text-muted-foreground text-xs">
                  {homework.section.code}
                </span>
              </div>
            </Table.Cell>
            <Table.Cell data-label={copy.createdAt} class="whitespace-nowrap tabular-nums text-muted-foreground">
              {formatDate(homework.createdAt)}
            </Table.Cell>
            <Table.Cell data-label={copy.homeworkDue} class="whitespace-nowrap tabular-nums text-muted-foreground">
              {homework.submissionDueAt
                ? formatDate(homework.submissionDueAt)
                : copy.notAvailable}
            </Table.Cell>
            <Table.Cell data-label={copy.status}>
              {#if homework.deletedAt}
                <Badge variant="destructive">{copy.homeworkStatusDeleted}</Badge>
              {:else}
                <Badge>{copy.homeworkStatusActive}</Badge>
              {/if}
            </Table.Cell>
            <Table.Cell>
              {#if !homework.deletedAt}
                <TableRowActions>
                  <TableIconButton
                    label={copy.deleteHomeworkAction}
                    variant="destructive"
                    onclick={() => onDelete(homework)}
                  >
                    <Trash2 />
                  </TableIconButton>
                </TableRowActions>
              {/if}
            </Table.Cell>
          </Table.Row>
        {:else}
          <Table.Row><Table.Cell colspan={6}><CollectionEmpty variant="compact" description={copy.noHomeworks} /></Table.Cell></Table.Row>
        {/each}
      </Table.Body>
    </Table.Root>
  </CollectionTableShell>
</section>
