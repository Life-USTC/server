<script lang="ts">
import SquarePen from "@lucide/svelte/icons/square-pen";
import DashboardTableIconButton from "@/features/dashboard/components/DashboardTableIconButton.svelte";
import DashboardTableRowActions from "@/features/dashboard/components/DashboardTableRowActions.svelte";
import TruncatedText from "$lib/components/TruncatedText.svelte";
import * as Table from "$lib/components/ui/table/index.js";
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

<div class="hidden min-w-0 md:block">
  <Table.Root class="w-full">
    <Table.Header>
      <Table.Row>
        <Table.Head>{copy.descriptionPreview}</Table.Head>
        <Table.Head>{copy.author}</Table.Head>
        <Table.Head>{copy.postedIn}</Table.Head>
        <Table.Head>{copy.editedAtLabel}</Table.Head>
        <Table.Head>
          <span class="sr-only">{copy.actions}</span>
        </Table.Head>
      </Table.Row>
    </Table.Header>
    <Table.Body>
      {#each descriptions as description}
        <Table.Row class="group">
          <Table.Cell>
            <TruncatedText
              class="text-sm"
              lines={2}
              preserveWhitespace
              text={description.content?.trim()
                ? description.content
                : copy.emptyDescription}
            />
          </Table.Cell>
          <Table.Cell>
            {adminModerationDescriptionLastEditor(description, copy)}
          </Table.Cell>
          <Table.Cell>
            <a
              class="block min-w-0 overflow-hidden hover:underline"
              href={descriptionTargetHref(description)}
            >
              <TruncatedText text={targetLabel(description)} />
            </a>
          </Table.Cell>
          <Table.Cell class="whitespace-nowrap tabular-nums text-muted-foreground">
            {formatDate(adminModerationDescriptionEditedAt(description))}
          </Table.Cell>
          <Table.Cell>
            <DashboardTableRowActions>
              <DashboardTableIconButton
                label={copy.manageDescription}
                onclick={() => {
                  onManage(description);
                }}
              >
                <SquarePen />
              </DashboardTableIconButton>
            </DashboardTableRowActions>
          </Table.Cell>
        </Table.Row>
      {/each}
    </Table.Body>
  </Table.Root>
</div>
