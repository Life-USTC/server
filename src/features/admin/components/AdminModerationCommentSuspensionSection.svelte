<script lang="ts">
import DateTimePicker from "$lib/components/DateTimePicker.svelte";
import { Button } from "$lib/components/ui/button/index.js";
import * as Field from "$lib/components/ui/field/index.js";
import { Input } from "$lib/components/ui/input/index.js";
import * as Select from "$lib/components/ui/select/index.js";
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

<Field.Set>
  <Field.Legend>{copy.suspensionDetails}</Field.Legend>
  <Field.Description>{copy.suspendAuthorDescription}</Field.Description>
  <Field.Group class="grid gap-2 md:grid-cols-[160px_1fr]">
    <Field.Field>
      <Field.Label class="sr-only" for="moderation-suspension-duration">{copy.suspendExpires}</Field.Label>
      <Select.Root bind:value={suspensionDuration} type="single">
        <Select.Trigger id="moderation-suspension-duration" class="w-full">
          {suspensionDurationOptions.find(
            (option) => option.value === suspensionDuration,
          )?.label ?? suspensionDurationOptions[0]?.label ?? ""}
        </Select.Trigger>
        <Select.Content>
          <Select.Group>
            {#each suspensionDurationOptions as option}
              <Select.Item label={option.label} value={option.value}>
                {option.label}
              </Select.Item>
            {/each}
          </Select.Group>
        </Select.Content>
      </Select.Root>
    </Field.Field>
    {#if suspensionDuration === "custom"}
      <Field.Field>
        <Field.Label id="moderation-suspension-custom-expires-label" class="sr-only">
          {copy.suspendExpires}
        </Field.Label>
        <DateTimePicker
          bind:value={customExpiresAt}
          aria-labelledby="moderation-suspension-custom-expires-label"
          calendarButtonLabel={copy.calendarButtonLabel}
          placeholder={copy.suspendExpires}
        />
      </Field.Field>
    {/if}
    <Field.Field class="md:col-span-2">
      <Field.Label class="sr-only" for="moderation-suspension-reason">{copy.suspendReason}</Field.Label>
      <Input
        id="moderation-suspension-reason"
        placeholder={copy.suspendReason}
        value={suspensionReason}
        oninput={(event: Event) => {
          suspensionReason = inputValue(event);
        }}
      />
    </Field.Field>
  </Field.Group>
  <Button
    disabled={isSuspendingUser || !comment.user?.id}
    size="sm"
    type="button"
    variant="destructive"
    onclick={suspendCommentAuthor}
  >
    {isSuspendingUser ? copy.suspending : copy.suspendAction}
  </Button>
</Field.Set>
