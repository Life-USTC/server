<script lang="ts">
import { Button } from "$lib/components/ui/button/index.js";
import * as Card from "$lib/components/ui/card/index.js";
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

<Card.Root class="hidden md:block">
  <Card.Content class="p-0">
    <Table.Root>
      <Table.Header>
        <Table.Row>
          <Table.Head>{copy.descriptionPreview}</Table.Head>
          <Table.Head>{copy.author}</Table.Head>
          <Table.Head>{copy.postedIn}</Table.Head>
          <Table.Head>{copy.editedAtLabel}</Table.Head>
          <Table.Head class="w-24 text-right">{copy.actions}</Table.Head>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {#each descriptions as description}
          <Table.Row class="cursor-pointer" onclick={() => onManage(description)}>
            <Table.Cell class="max-w-md font-medium">
              <p class="line-clamp-2 whitespace-pre-wrap text-sm">
                {description.content?.trim() ? description.content : copy.emptyDescription}
              </p>
            </Table.Cell>
            <Table.Cell class="font-medium">
              {adminModerationDescriptionLastEditor(description, copy)}
            </Table.Cell>
            <Table.Cell class="max-w-sm text-sm">
              <a
                class="hover:underline"
                href={descriptionTargetHref(description)}
                onclick={(event) => event.stopPropagation()}
              >
                {targetLabel(description)}
              </a>
            </Table.Cell>
            <Table.Cell class="text-base-content/60 text-xs">
              {formatDate(adminModerationDescriptionEditedAt(description))}
            </Table.Cell>
            <Table.Cell class="text-right">
              <Button
                size="sm"
                type="button"
                variant="outline"
                onclick={(event: MouseEvent) => {
                  event.stopPropagation();
                  onManage(description);
                }}
              >
                {copy.manageDescription}
              </Button>
            </Table.Cell>
          </Table.Row>
        {/each}
      </Table.Body>
    </Table.Root>
  </Card.Content>
</Card.Root>
