<script lang="ts">
import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";
import SquarePen from "@lucide/svelte/icons/square-pen";
import ResultsSummary from "#lib/components/ResultsSummary.svelte";
import TableControlsRow from "#lib/components/TableControlsRow.svelte";
import TableIconButton from "#lib/components/TableIconButton.svelte";
import TableRowActions from "#lib/components/TableRowActions.svelte";
import TruncatedText from "#lib/components/TruncatedText.svelte";
import { Button } from "#lib/components/ui/button/index.js";
import * as Item from "#lib/components/ui/item/index.js";
import * as Table from "#lib/components/ui/table/index.js";
import {
  adminModerationDescriptionEditedAt,
  adminModerationDescriptionLastEditor,
} from "./admin-moderation-description-display";
import type {
  AdminModerationDescription,
  AdminModerationDescriptionCopy,
} from "./admin-moderation-description-types";
import type { AdminModerationFilterControls } from "./admin-moderation-page-types";
import ModerationCollection from "./ModerationCollection.svelte";

export let filterControls: AdminModerationFilterControls;
export let copy: AdminModerationDescriptionCopy;
export let descriptions: AdminModerationDescription[];
export let descriptionTargetHref: (
  description: AdminModerationDescription,
) => string;
export let formatDate: (value: string | Date) => string;
export let formatMessage: (
  template: string,
  values: Record<string, string>,
) => string;
export let onManage: (description: AdminModerationDescription) => void;
export let targetLabel: (description: AdminModerationDescription) => string;
</script>

<section class="grid grid-cols-[minmax(0,1fr)] gap-3">
  <ResultsSummary
    summary={formatMessage(descriptions.length === 1 ? copy.showingResultsOne : copy.showingResults, {
        count: String(descriptions.length),
      })}
  />

  <ModerationCollection
    {filterControls}
    items={descriptions}
    label={copy.descriptionPreview}
    emptyDescription={copy.noDescriptions}
    fields={["search", "author", "editedAt", "descriptionContent", "descriptionTarget"]}
  >
    {#snippet card(description: AdminModerationDescription)}
    <Item.Content class="min-w-0 gap-2">
      <Item.Title class="line-clamp-4 whitespace-pre-wrap">{description.content || copy.emptyDescription}</Item.Title>
      <Item.Description>{targetLabel(description)}</Item.Description>
      <Item.Description>
        {formatDate(adminModerationDescriptionEditedAt(description))}
      </Item.Description>
      <Item.Description>
        {formatMessage(copy.lastEditor, {
          name: adminModerationDescriptionLastEditor(description, copy),
        })}
      </Item.Description>
    </Item.Content>
    <Item.Actions class="shrink-0 self-start">
      <Button
        aria-label={copy.manageDescription}
        onclick={() => onManage(description)}
        size="sm"
        type="button"
        variant="ghost"
      >
        {copy.manageDescription}
        <ChevronRightIcon aria-hidden="true" data-icon="inline-end" />
      </Button>
    </Item.Actions>
    {/snippet}
    {#snippet desktop(emptyState)}
      <Table.Root class="w-full min-w-[54rem]">
        <Table.Header>
          <TableControlsRow colspan={5}>{@render filterControls("search", "desktop")}</TableControlsRow>
          <Table.Row>
            <Table.Head class="w-[36%]">{@render filterControls("descriptionContent", "desktop")}</Table.Head>
            <Table.Head class="w-[18%]">{@render filterControls("author", "desktop")}</Table.Head>
            <Table.Head class="w-[22%]">{@render filterControls("descriptionTarget", "desktop")}</Table.Head>
            <Table.Head class="w-[14%]">{@render filterControls("editedAt", "desktop")}</Table.Head>
            <Table.Head class="w-14 min-w-14">
              <span class="sr-only">{copy.actions}</span>
            </Table.Head>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {#each descriptions as description}
            <Table.Row class="group">
              <Table.Cell class="max-w-0">
                <TruncatedText
                  class="text-sm font-medium"
                  lines={2}
                  preserveWhitespace
                  text={description.content?.trim()
                    ? description.content
                    : copy.emptyDescription}
                />
              </Table.Cell>
              <Table.Cell class="max-w-0">
                {@const author = adminModerationDescriptionLastEditor(description, copy)}
                <span class="block max-w-full truncate" title={author}>{author}</span>
              </Table.Cell>
              <Table.Cell class="max-w-0">
                <a
                  class="block min-w-0 max-w-full overflow-hidden hover:underline"
                  href={descriptionTargetHref(description)}
                  title={targetLabel(description)}
                >
                  <TruncatedText text={targetLabel(description)} />
                </a>
              </Table.Cell>
              <Table.Cell class="whitespace-nowrap text-left tabular-nums text-muted-foreground">
                {formatDate(adminModerationDescriptionEditedAt(description))}
              </Table.Cell>
              <Table.Cell class="w-14 min-w-14 text-left">
                <TableRowActions>
                  <TableIconButton
                    label={copy.manageDescription}
                    onclick={() => {
                      onManage(description);
                    }}
                  >
                    <SquarePen />
                  </TableIconButton>
                </TableRowActions>
              </Table.Cell>
            </Table.Row>
          {:else}
            <Table.Row><Table.Cell colspan={5}>{@render emptyState()}</Table.Cell></Table.Row>
          {/each}
        </Table.Body>
      </Table.Root>
    {/snippet}
  </ModerationCollection>
</section>
