<script lang="ts">
import DateTimePicker from "$lib/components/DateTimePicker.svelte";
import { Button } from "$lib/components/ui/button/index.js";
import { Input } from "$lib/components/ui/input/index.js";
import { Select } from "$lib/components/ui/select/index.js";
import type { AdminModerationComment } from "./admin-moderation-comment-types";
import type {
  AdminModerationCopy,
  AdminModerationDurationOption,
} from "./admin-moderation-page-types";

export let comment: AdminModerationComment;
export let copy: AdminModerationCopy;
export let customExpiresAt: string;
export let inputValue: (event: Event) => string;
export let isSuspendingUser: boolean;
export let suspendCommentAuthor: () => void;
export let suspensionDuration: string;
export let suspensionDurationOptions: AdminModerationDurationOption[];
export let suspensionReason: string;
</script>

<section class="grid gap-3 rounded border border-base-300 p-4">
  <div>
    <h3 class="font-medium">{copy.suspensionDetails}</h3>
    <p class="text-base-content/60 text-sm">{copy.suspendAuthorDescription}</p>
  </div>
  <div class="grid gap-2 md:grid-cols-[160px_1fr]">
    <Select bind:value={suspensionDuration} items={suspensionDurationOptions} />
    {#if suspensionDuration === "custom"}
      <DateTimePicker
        bind:value={customExpiresAt}
        placeholder={copy.suspendExpires}
      />
    {/if}
    <Input
      class="md:col-span-2"
      placeholder={copy.suspendReason}
      value={suspensionReason}
      oninput={(event: Event) => {
        suspensionReason = inputValue(event);
      }}
    />
  </div>
  <div>
    <Button
      class="border-warning bg-warning text-warning-content hover:bg-warning/90"
      disabled={isSuspendingUser || !comment.user?.id}
      size="sm"
      type="button"
      onclick={suspendCommentAuthor}
    >
      {isSuspendingUser ? copy.suspending : copy.suspendAction}
    </Button>
  </div>
</section>
