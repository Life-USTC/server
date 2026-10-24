<script lang="ts">
import Trash2 from "@lucide/svelte/icons/trash-2";
import CollectionEmpty from "#lib/components/CollectionEmpty.svelte";
import CollectionListShell from "#lib/components/CollectionListShell.svelte";
import CollectionTableShell from "#lib/components/CollectionTableShell.svelte";
import MobileListCard from "#lib/components/MobileListCard.svelte";
import ResponsiveCollection from "#lib/components/ResponsiveCollection.svelte";
import TableControlsRow from "#lib/components/TableControlsRow.svelte";
import TableIconButton from "#lib/components/TableIconButton.svelte";
import TableRowActions from "#lib/components/TableRowActions.svelte";
import TruncatedText from "#lib/components/TruncatedText.svelte";
import { Badge } from "#lib/components/ui/badge/index.js";
import { Button } from "#lib/components/ui/button/index.js";
import * as Item from "#lib/components/ui/item/index.js";
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
    <ResponsiveCollection>
      {#snippet mobile()}
        <div class="mb-3 flex flex-wrap items-center gap-2" data-slot="collection-header">
          {@render filterControls("search", "mobile")}
          {@render filterControls("content", "mobile")}
          {@render filterControls("target", "mobile")}
          {@render filterControls("createdAt", "mobile")}
          {@render filterControls("dueAt", "mobile")}

          {@render filterControls("status", "mobile")}
        </div>
        {#if homeworks.length === 0}<CollectionEmpty variant="compact" description={copy.noHomeworks} />{:else}
        <CollectionListShell>
          <Item.Group class="gap-0">
          {#each homeworks as homework, index (homework.id)}
            <MobileListCard>
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
                    aria-label={copy.deleteHomeworkAction}
                    onclick={() => onDelete(homework)}
                    size="sm"
                    type="button"
                    variant="destructive"
                  >
                    <Trash2 data-icon="inline-start" />
                    {copy.deleteHomeworkAction}
                  </Button>
                {/if}
              </Item.Actions>
            </MobileListCard>
            {#if index < homeworks.length - 1}<Item.Separator class="my-0" />{/if}
          {/each}
          </Item.Group>
        </CollectionListShell>
        {/if}
      {/snippet}
      {#snippet desktop()}

        <div class="min-w-0">
          <CollectionTableShell label={copy.homeworkTitle}>
            <Table.Root class="w-full min-w-[62rem]">
            <Table.Header>
        <TableControlsRow colspan={6}>{@render filterControls("search", "desktop")}</TableControlsRow>
              <Table.Row>
                <Table.Head class="w-[28%]">{@render filterControls("content", "desktop")}</Table.Head>
                <Table.Head class="w-[22%]">{@render filterControls("target", "desktop")}</Table.Head>
                <Table.Head class="w-[16%] text-right">{@render filterControls("createdAt", "desktop")}</Table.Head>
                <Table.Head class="w-[16%] text-right">{@render filterControls("dueAt", "desktop")}</Table.Head>
                <Table.Head class="w-[12%] text-center">{@render filterControls("status", "desktop")}</Table.Head>
                <Table.Head class="w-14 min-w-14 text-right">
                  <span class="sr-only">{copy.actions}</span>
                </Table.Head>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {#each homeworks as homework}
                <Table.Row class="group">
                  <Table.Cell class="max-w-0">
                    <TruncatedText class="font-medium" text={homework.title} />
                    <TruncatedText class="text-muted-foreground text-xs" text={`${copy.author}: ${creatorLabel(homework)}`} />
                  </Table.Cell>
                  <Table.Cell class="max-w-0">
                    <div class="grid min-w-0 gap-0.5">
                      <TruncatedText text={homework.section.course.nameCn} />
                      <span class="font-mono text-muted-foreground text-xs">
                        {homework.section.code}
                      </span>
                    </div>
                  </Table.Cell>
                  <Table.Cell class="whitespace-nowrap text-right tabular-nums text-muted-foreground">
                    {formatDate(homework.createdAt)}
                  </Table.Cell>
                  <Table.Cell class="whitespace-nowrap text-right tabular-nums text-muted-foreground">
                    {homework.submissionDueAt
                      ? formatDate(homework.submissionDueAt)
                      : copy.notAvailable}
                  </Table.Cell>
                  <Table.Cell class="text-center">
                    {#if homework.deletedAt}
                      <Badge variant="destructive">{copy.homeworkStatusDeleted}</Badge>
                    {:else}
                      <Badge>{copy.homeworkStatusActive}</Badge>
                    {/if}
                  </Table.Cell>
                  <Table.Cell class="w-14 min-w-14 text-right">
                    {#if !homework.deletedAt}
                      <TableRowActions class="justify-end">
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
        </div>
      {/snippet}
    </ResponsiveCollection>
</section>
