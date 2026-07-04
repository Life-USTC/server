<script lang="ts">
import * as Field from "$lib/components/ui/field/index.js";
import { Input } from "$lib/components/ui/input/index.js";
import * as ToggleGroup from "$lib/components/ui/toggle-group/index.js";
import type {
  AdminModerationCopy,
  AdminModerationStatusOptions,
} from "./admin-moderation-page-types";

export let commentStatus: "active" | "softbanned" | "deleted";
export let commentStatusOptions: AdminModerationStatusOptions;
export let copy: AdminModerationCopy;
export let inputValue: (event: Event) => string;
export let moderationNote: string;

function selectStatus(value: string) {
  if (value === "active" || value === "softbanned" || value === "deleted") {
    commentStatus = value;
  }
}
</script>

<Field.Group class="gap-3">
  <Field.Set>
    <Field.Legend id="admin-comment-status-label" variant="label">{copy.status}</Field.Legend>
    <ToggleGroup.Root
      aria-labelledby="admin-comment-status-label"
      class="grid w-full md:grid-cols-3"
      spacing={2}
      type="single"
      value={commentStatus}
      variant="outline"
      onValueChange={selectStatus}
    >
      {#each commentStatusOptions as [status, label]}
        <ToggleGroup.Item
          class="w-full"
          value={status}
        >
          {label}
        </ToggleGroup.Item>
      {/each}
    </ToggleGroup.Root>
  </Field.Set>
  <Field.Field>
    <Field.Label for="admin-comment-moderation-note">{copy.moderationNote}</Field.Label>
    <Input
      id="admin-comment-moderation-note"
      placeholder={copy.moderationNote}
      value={moderationNote}
      oninput={(event: Event) => {
        moderationNote = inputValue(event);
      }}
    />
  </Field.Field>
</Field.Group>
