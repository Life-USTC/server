<script lang="ts">
import { Button } from "$lib/components/ui/button/index.js";
import { Input } from "$lib/components/ui/input/index.js";
import type {
  AdminModerationCopy,
  AdminModerationStatusOptions,
} from "./admin-moderation-page-types";

export let commentStatus: "active" | "softbanned" | "deleted";
export let commentStatusOptions: AdminModerationStatusOptions;
export let copy: AdminModerationCopy;
export let inputValue: (event: Event) => string;
export let moderationNote: string;
</script>

<section class="grid gap-3">
  <h3 class="font-medium">{copy.status}</h3>
  <div class="grid gap-2 md:grid-cols-3">
    {#each commentStatusOptions as [status, label]}
      <Button
        aria-pressed={commentStatus === status}
        type="button"
        variant={commentStatus === status ? "secondary" : "outline"}
        onclick={() => {
          commentStatus = status as "active" | "softbanned" | "deleted";
        }}
      >
        {label}
      </Button>
    {/each}
  </div>
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
