<script lang="ts">
import ResultsSummary from "#lib/components/ResultsSummary.svelte";
import TableControlsRow from "#lib/components/TableControlsRow.svelte";
import TruncatedText from "#lib/components/TruncatedText.svelte";
import * as Item from "#lib/components/ui/item/index.js";
import Table from "#lib/components/ui/table/table.svelte";
import AdminEditAction from "./AdminEditAction.svelte";
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
      <AdminEditAction layout="card" label={copy.manageDescription} onclick={() => onManage(description)} />
    </Item.Actions>
    {/snippet}
    {#snippet desktop(emptyState)}
      <Table class="w-full min-w-[54rem]">
        <thead>
          <TableControlsRow colspan={5}>{@render filterControls("search", "desktop")}</TableControlsRow>
          <tr>
            <th class="w-[36%]">{@render filterControls("descriptionContent", "desktop")}</th>
            <th class="w-[18%]">{@render filterControls("author", "desktop")}</th>
            <th class="w-[22%]">{@render filterControls("descriptionTarget", "desktop")}</th>
            <th class="w-[14%]">{@render filterControls("editedAt", "desktop")}</th>
            <th class="w-14 min-w-14">
              <span class="sr-only">{copy.actions}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {#each descriptions as description}
            {@const author = adminModerationDescriptionLastEditor(description, copy)}
            <tr class="group">
              <td class="max-w-0">
                <TruncatedText
                  class="text-sm font-medium"
                  lines={2}
                  preserveWhitespace
                  text={description.content?.trim()
                    ? description.content
                    : copy.emptyDescription}
                />
              </td>
              <td class="max-w-0">
                <span class="block max-w-full truncate" title={author}>{author}</span>
              </td>
              <td class="max-w-0">
                <a
                  class="block min-w-0 max-w-full overflow-hidden hover:underline"
                  href={descriptionTargetHref(description)}
                  title={targetLabel(description)}
                >
                  <TruncatedText text={targetLabel(description)} />
                </a>
              </td>
              <td class="whitespace-nowrap text-left tabular-nums text-muted-foreground">
                {formatDate(adminModerationDescriptionEditedAt(description))}
              </td>
              <td class="w-14 min-w-14 text-left">
                <AdminEditAction layout="table" label={copy.manageDescription} onclick={() => onManage(description)} />
              </td>
            </tr>
          {:else}
            <tr><td colspan={5}>{@render emptyState()}</td></tr>
          {/each}
        </tbody>
      </Table>
    {/snippet}
  </ModerationCollection>
</section>
