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
  <Card.Title class="min-w-0 break-words">{copy.title}</Card.Title>
  {#if description.lastEditedAt}
    <Card.Description>
      {formatDescriptionCopy(copy.lastEdited, { date: formatDate(description.lastEditedAt) })}
      ·
      {formatDescriptionCopy(copy.editedBy, { name: editorName(description.lastEditedBy) })}
    </Card.Description>
  {:else}
    <Card.Description>{copy.empty}</Card.Description>
  {/if}
  <Card.Action>
    {#if viewer.isAuthenticated && !viewer.isSuspended && !editing}
      <Button size="sm" type="button" variant="outline" onclick={onStartEdit}>
        {copy.edit}
      </Button>
    {:else if !viewer.isAuthenticated}
      <Button href="/account/sign-in" size="sm" variant="outline">{copy.loginToEdit}</Button>
    {/if}
  </Card.Action>
</Card.Header>
