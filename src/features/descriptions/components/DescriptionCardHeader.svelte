<script lang="ts">
import { formatDescriptionCopy } from "@/features/descriptions/lib/description-card-actions";
import { Button } from "$lib/components/ui/button/index.js";
import * as Card from "$lib/components/ui/card/index.js";
import type {
  DescriptionContent,
  DescriptionCopy,
  DescriptionViewer,
} from "./description-component-types";

export let copy: DescriptionCopy;
export let description: DescriptionContent;
export let editing: boolean;
export let editorName: (value: DescriptionContent["lastEditedBy"]) => string;
export let formatDate: (value: string | null | undefined) => string;
export let onStartEdit: () => void;
export let viewer: DescriptionViewer;
</script>

<Card.Header>
  <div class="flex flex-wrap items-start justify-between gap-3">
    <div class="grid gap-1">
      <div class="flex flex-wrap items-center gap-2">
        <Card.Title>{copy.title}</Card.Title>
      </div>
      {#if description.lastEditedAt}
        <Card.Description>
          {formatDescriptionCopy(copy.lastEdited, { date: formatDate(description.lastEditedAt) })}
          ·
          {formatDescriptionCopy(copy.editedBy, { name: editorName(description.lastEditedBy) })}
        </Card.Description>
      {:else}
        <Card.Description>{copy.empty}</Card.Description>
      {/if}
    </div>
    {#if viewer.isAuthenticated && !viewer.isSuspended && !editing}
      <Button size="sm" type="button" variant="outline" onclick={onStartEdit}>
        {copy.edit}
      </Button>
    {:else if !viewer.isAuthenticated}
      <Button href="/signin" size="sm" variant="outline">{copy.loginToEdit}</Button>
    {/if}
  </div>
</Card.Header>
