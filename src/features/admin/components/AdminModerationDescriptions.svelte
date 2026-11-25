<script lang="ts">
import ResultsSummary from "#lib/components/ResultsSummary.svelte";
import TruncatedText from "#lib/components/TruncatedText.svelte";
import * as Item from "#lib/components/ui/item/index.js";
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
    tableClass="w-full min-w-[54rem]"
    actionsLabel={copy.actions}
    columns={[
      ["descriptionContent", 36],
      ["author", 18],
      ["descriptionTarget", 22],
      ["editedAt", 14],
    ]}
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
    {#snippet cells(description: AdminModerationDescription)}
      {@const author = adminModerationDescriptionLastEditor(description, copy)}
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
    {/snippet}
  </ModerationCollection>
</section>
