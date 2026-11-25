<script lang="ts">
import Trash2 from "@lucide/svelte/icons/trash-2";
import TableIconButton from "#lib/components/TableIconButton.svelte";
import TableRowActions from "#lib/components/TableRowActions.svelte";
import TruncatedText from "#lib/components/TruncatedText.svelte";
import { Badge } from "#lib/components/ui/badge/index.js";
import { Button } from "#lib/components/ui/button/index.js";
import * as Item from "#lib/components/ui/item/index.js";
import type {
  AdminModerationFilterControls,
  AdminModerationHomework,
} from "./admin-moderation-page-types";
import ModerationCollection from "./ModerationCollection.svelte";

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
  <ModerationCollection
    tableClass="w-full min-w-[62rem]"
    actionsLabel={copy.actions}
    columns={[
      ["content", 28],
      ["target", 22],
      ["createdAt", 16],
      ["dueAt", 16],
      ["status", 12],
    ]}
    {filterControls}
    items={homeworks}
    label={copy.homeworkTitle}
    emptyDescription={copy.noHomeworks}
    fields={["search", "content", "target", "createdAt", "dueAt", "status"]}
  >
    {#snippet card(homework: AdminModerationHomework)}
      <Item.Content class="min-w-0 gap-2">
        <Item.Title class="line-clamp-none" title={homework.title}>{homework.title}</Item.Title>
        <Item.Description>
          {homework.section.course.nameCn} ·
          <span class="font-mono">{homework.section.code}</span>
        </Item.Description>
        <Item.Description>{copy.author}: {creatorLabel(homework)}</Item.Description>
        <Item.Description class="tabular-nums">
          {copy.createdAt}
          {formatDate(homework.createdAt)} · {copy.homeworkDue}
          {homework.submissionDueAt
            ? formatDate(homework.submissionDueAt)
            : copy.notAvailable}
        </Item.Description>
      </Item.Content>
      <Item.Actions class="flex-wrap items-center gap-2">
        {#if homework.deletedAt}
          <Badge variant="destructive">{copy.homeworkStatusDeleted}</Badge>
        {:else}
          <Badge>{copy.homeworkStatusActive}</Badge>
          <Button
            icon={Trash2}
            aria-label={copy.deleteHomeworkAction}
            onclick={() => onDelete(homework)}
            size="sm"
            variant="destructive"
          >
            {copy.deleteHomeworkAction}
          </Button>
        {/if}
      </Item.Actions>
    {/snippet}
    {#snippet cells(homework: AdminModerationHomework)}
      <td class="max-w-0">
        <TruncatedText class="font-medium" text={homework.title} />
        <TruncatedText class="text-muted-foreground text-xs" text={`${copy.author}: ${creatorLabel(homework)}`} />
      </td>
      <td class="max-w-0">
        <div class="grid min-w-0 gap-0.5">
          <TruncatedText text={homework.section.course.nameCn} />
          <span class="font-mono text-muted-foreground text-xs">
            {homework.section.code}
          </span>
        </div>
      </td>
      <td class="whitespace-nowrap text-left tabular-nums text-muted-foreground">
        {formatDate(homework.createdAt)}
      </td>
      <td class="whitespace-nowrap text-left tabular-nums text-muted-foreground">
        {homework.submissionDueAt
          ? formatDate(homework.submissionDueAt)
          : copy.notAvailable}
      </td>
      <td class="text-left">
        {#if homework.deletedAt}
          <Badge variant="destructive">{copy.homeworkStatusDeleted}</Badge>
        {:else}
          <Badge>{copy.homeworkStatusActive}</Badge>
        {/if}
      </td>
      <td class="w-14 min-w-14 text-left">
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
      </td>
    {/snippet}
  </ModerationCollection>
</section>
