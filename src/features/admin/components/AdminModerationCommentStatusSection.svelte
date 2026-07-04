<script lang="ts">
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

<section class="grid gap-3">
  <h3 class="font-medium">{copy.status}</h3>
  <ToggleGroup.Root
    aria-label={copy.status}
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
  <label class="grid gap-2">
    <span class="font-medium text-sm">{copy.moderationNote}</span>
    <Input
      placeholder={copy.moderationNote}
      value={moderationNote}
      oninput={(event: Event) => {
        moderationNote = inputValue(event);
      }}
    />
  </label>
</section>
