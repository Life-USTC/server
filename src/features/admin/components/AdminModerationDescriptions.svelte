<script lang="ts">
import SquarePen from "@lucide/svelte/icons/square-pen";
import CollectionEmpty from "#lib/components/CollectionEmpty.svelte";
import CollectionTableShell from "#lib/components/CollectionTableShell.svelte";
import TableControlsRow from "#lib/components/TableControlsRow.svelte";
import TableIconButton from "#lib/components/TableIconButton.svelte";
import TableRowActions from "#lib/components/TableRowActions.svelte";
import TruncatedText from "#lib/components/TruncatedText.svelte";
import * as Table from "#lib/components/ui/table/index.js";
import AdminModerationDescriptionSummary from "./AdminModerationDescriptionSummary.svelte";
import {
  adminModerationDescriptionEditedAt,
  adminModerationDescriptionLastEditor,
} from "./admin-moderation-description-display";
import type {
  AdminModerationDescription,
  AdminModerationDescriptionCopy,
} from "./admin-moderation-description-types";
import type { AdminModerationFilterControls } from "./admin-moderation-page-types";

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
  <AdminModerationDescriptionSummary
    {copy}
    count={descriptions.length}
    {formatMessage}
  />

  <CollectionTableShell cards label={copy.descriptionPreview}>
    <Table.Root class="w-full min-w-[54rem]">
      <Table.Header>
        <TableControlsRow colspan={5}>{@render filterControls("search")}</TableControlsRow>
        <Table.Row>
          <Table.Head class="w-[36%]">{@render filterControls("descriptionContent")}</Table.Head>
          <Table.Head class="w-[18%]">{@render filterControls("author")}</Table.Head>
          <Table.Head class="w-[22%]">{@render filterControls("descriptionTarget")}</Table.Head>
          <Table.Head class="w-[14%]">{@render filterControls("editedAt")}</Table.Head>
          <Table.Head class="w-14 min-w-14">
            <span class="sr-only">{copy.actions}</span>
          </Table.Head>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {#each descriptions as description}
          <Table.Row class="group">
            <Table.Cell data-label={copy.descriptionPreview} class="max-w-0">
              <TruncatedText
                class="text-sm font-medium"
                lines={2}
                preserveWhitespace
                text={description.content?.trim()
                  ? description.content
                  : copy.emptyDescription}
              />
            </Table.Cell>
            <Table.Cell data-label={copy.author} class="max-w-0">
              {@const author = adminModerationDescriptionLastEditor(description, copy)}
              <span class="block max-w-full truncate" title={author}>{author}</span>
            </Table.Cell>
            <Table.Cell data-label={copy.descriptionTarget} class="max-w-0">
              <a
                class="block min-w-0 max-w-full overflow-hidden hover:underline"
                href={descriptionTargetHref(description)}
                title={targetLabel(description)}
              >
                <TruncatedText text={targetLabel(description)} />
              </a>
            </Table.Cell>
            <Table.Cell data-label={copy.editedAtLabel} class="whitespace-nowrap tabular-nums text-muted-foreground">
              {formatDate(adminModerationDescriptionEditedAt(description))}
            </Table.Cell>
            <Table.Cell>
              <TableRowActions>
                <TableIconButton
                  label={copy.manageDescription}
                  onclick={() => onManage(description)}
                >
                  <SquarePen />
                </TableIconButton>
              </TableRowActions>
            </Table.Cell>
          </Table.Row>
        {:else}
          <Table.Row><Table.Cell colspan={5}><CollectionEmpty variant="compact" description={copy.noDescriptions} /></Table.Cell></Table.Row>
        {/each}
      </Table.Body>
    </Table.Root>
  </CollectionTableShell>
</section>
