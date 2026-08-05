<script lang="ts">
import Trash2 from "@lucide/svelte/icons/trash-2";
import DashboardTableIconButton from "@/features/dashboard/components/DashboardTableIconButton.svelte";
import DashboardTableRowActions from "@/features/dashboard/components/DashboardTableRowActions.svelte";
import SoftEmptyMessage from "$lib/components/SoftEmptyMessage.svelte";
import TruncatedText from "$lib/components/TruncatedText.svelte";
import { Badge } from "$lib/components/ui/badge/index.js";
import * as Item from "$lib/components/ui/item/index.js";
import * as Table from "$lib/components/ui/table/index.js";

type ModerationHomework = {
  createdAt: string | Date;
  deletedAt?: string | Date | null;
  id: string;
  section: {
    code: string;
    course: { nameCn: string };
  };
  submissionDueAt?: string | Date | null;
  title: string;
};

type HomeworksCopy = {
  actions: string;
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

export let copy: HomeworksCopy;
export let formatDate: (value: string | Date) => string;
export let homeworks: ModerationHomework[];
export let onDelete: (homework: ModerationHomework) => void;
</script>

<section class="grid gap-3">
  {#if homeworks.length === 0}
    <SoftEmptyMessage message={copy.noHomeworks} />
  {:else}
    <Item.Group class="md:hidden">
      {#each homeworks as homework}
        <Item.Root variant="outline" class="items-start">
          <Item.Content class="min-w-0 gap-2">
            <Item.Title class="line-clamp-none">{homework.title}</Item.Title>
            <Item.Description>
              {homework.section.course.nameCn} ·
              <span class="font-mono">{homework.section.code}</span>
            </Item.Description>
            <Item.Description class="tabular-nums">
              {copy.createdAt}
              {formatDate(homework.createdAt)} · {copy.homeworkDue}
              {homework.submissionDueAt
                ? formatDate(homework.submissionDueAt)
                : copy.notAvailable}
            </Item.Description>
          </Item.Content>
          <Item.Actions class="items-center gap-2">
            {#if homework.deletedAt}
              <Badge variant="destructive">{copy.homeworkStatusDeleted}</Badge>
            {:else}
              <Badge>{copy.homeworkStatusActive}</Badge>
              <DashboardTableIconButton
                label={copy.deleteHomeworkAction}
                variant="destructive"
                onclick={() => onDelete(homework)}
              >
                <Trash2 />
              </DashboardTableIconButton>
            {/if}
          </Item.Actions>
        </Item.Root>
      {/each}
    </Item.Group>

    <div class="hidden min-w-0 md:block">
      <Table.Root class="w-full">
        <Table.Header>
          <Table.Row>
            <Table.Head>{copy.homeworkTitle}</Table.Head>
            <Table.Head>{copy.homeworkSection}</Table.Head>
            <Table.Head>{copy.createdAt}</Table.Head>
            <Table.Head>{copy.homeworkDue}</Table.Head>
            <Table.Head>{copy.status}</Table.Head>
            <Table.Head>
              <span class="sr-only">{copy.actions}</span>
            </Table.Head>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {#each homeworks as homework}
            <Table.Row class="group">
              <Table.Cell>
                <TruncatedText class="font-medium" text={homework.title} />
              </Table.Cell>
              <Table.Cell>
                <div class="grid min-w-0 gap-0.5">
                  <TruncatedText text={homework.section.course.nameCn} />
                  <span class="font-mono text-muted-foreground text-xs">
                    {homework.section.code}
                  </span>
                </div>
              </Table.Cell>
              <Table.Cell class="whitespace-nowrap tabular-nums text-muted-foreground">
                {formatDate(homework.createdAt)}
              </Table.Cell>
              <Table.Cell class="whitespace-nowrap tabular-nums text-muted-foreground">
                {homework.submissionDueAt
                  ? formatDate(homework.submissionDueAt)
                  : copy.notAvailable}
              </Table.Cell>
              <Table.Cell>
                {#if homework.deletedAt}
                  <Badge variant="destructive">{copy.homeworkStatusDeleted}</Badge>
                {:else}
                  <Badge>{copy.homeworkStatusActive}</Badge>
                {/if}
              </Table.Cell>
              <Table.Cell>
                {#if !homework.deletedAt}
                  <DashboardTableRowActions>
                    <DashboardTableIconButton
                      label={copy.deleteHomeworkAction}
                      variant="destructive"
                      onclick={() => onDelete(homework)}
                    >
                      <Trash2 />
                    </DashboardTableIconButton>
                  </DashboardTableRowActions>
                {/if}
              </Table.Cell>
            </Table.Row>
          {/each}
        </Table.Body>
      </Table.Root>
    </div>
  {/if}
</section>
