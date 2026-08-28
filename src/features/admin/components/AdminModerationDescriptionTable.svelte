<script lang="ts">
import SquarePen from "@lucide/svelte/icons/square-pen";
import TableIconButton from "$lib/components/TableIconButton.svelte";
import TableRowActions from "$lib/components/TableRowActions.svelte";
import TruncatedText from "$lib/components/TruncatedText.svelte";
import * as Table from "$lib/components/ui/table/index.js";
import AdminTableShell from "./AdminTableShell.svelte";
import {
  adminModerationDescriptionEditedAt,
  adminModerationDescriptionLastEditor,
} from "./admin-moderation-description-display";
import type {
  AdminModerationDescription,
  AdminModerationDescriptionCopy,
} from "./admin-moderation-description-types";

export let copy: AdminModerationDescriptionCopy;
export let descriptions: AdminModerationDescription[];
export let descriptionTargetHref: (
  description: AdminModerationDescription,
) => string;
export let formatDate: (value: string | Date) => string;
export let onManage: (description: AdminModerationDescription) => void;
export let targetLabel: (description: AdminModerationDescription) => string;
</script>

<div class="hidden min-w-0 xl:block">
  <AdminTableShell label={copy.descriptionPreview}>
    <Table.Root class="w-full min-w-[54rem]">
      <Table.Header>
        <Table.Row>
          <Table.Head class="w-[36%]">{copy.descriptionPreview}</Table.Head>
          <Table.Head class="w-[18%]">{copy.author}</Table.Head>
          <Table.Head class="w-[22%]">{copy.postedIn}</Table.Head>
          <Table.Head class="w-[14%] text-right">{copy.editedAtLabel}</Table.Head>
          <Table.Head class="w-14 min-w-14 text-right">
            <span class="sr-only">{copy.actions}</span>
          </Table.Head>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {#each descriptions as description}
          <Table.Row class="group">
            <Table.Cell class="max-w-0">
              <TruncatedText
                class="text-sm"
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
            <Table.Cell class="whitespace-nowrap text-right tabular-nums text-muted-foreground">
              {formatDate(adminModerationDescriptionEditedAt(description))}
            </Table.Cell>
            <Table.Cell class="w-14 min-w-14 text-right">
              <TableRowActions class="justify-end">
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
        {/each}
      </Table.Body>
    </Table.Root>
  </AdminTableShell>
</div>
