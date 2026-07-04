<script lang="ts">
import DateTimePicker from "$lib/components/DateTimePicker.svelte";
import CheckCircleIcon from "$lib/components/icons/check-circle.svelte";
import ShieldAlertIcon from "$lib/components/icons/shield-alert.svelte";
import { Badge } from "$lib/components/ui/badge/index.js";
import { Button } from "$lib/components/ui/button/index.js";
import * as Field from "$lib/components/ui/field/index.js";
import { Input } from "$lib/components/ui/input/index.js";
import * as Select from "$lib/components/ui/select/index.js";
import type {
  AdminUserFormatter,
  AdminUserRow,
  AdminUsersCopy,
  AdminUsersModerationCopy,
} from "./admin-user-types";

export let copy: AdminUsersCopy;
export let inputValue: (event: Event) => string;
export let isLiftingSuspension: boolean;
export let isSuspending: boolean;
export let liftSelectedSuspension: () => void | Promise<void>;
export let moderationCopy: AdminUsersModerationCopy;
export let selectedUser: AdminUserRow;
export let suspendDuration: string;
export let suspendDurationOptions: Array<{ label: string; value: string }>;
export let suspendExpiresAt: string;
export let suspendReason: string;
export let suspendSelectedUser: () => void | Promise<void>;
export let suspensionLabel: AdminUserFormatter;
</script>

<section class="grid gap-4 rounded-md border border-base-300 bg-base-200/40 p-3">
  <Field.Set>
    <Field.Legend class="flex flex-wrap items-center gap-2 text-error">
      <span>{copy.suspendTitle}</span>
      {#if selectedUser.activeSuspension}
        <Badge class="border-warning bg-warning/10 text-warning" variant="outline">
          {suspensionLabel(selectedUser)}
        </Badge>
      {/if}
    </Field.Legend>
    <Field.Description>{copy.suspendDescription}</Field.Description>
    <Field.Group class="grid gap-4 sm:grid-cols-2">
      <Field.Field>
        <Field.Label for="admin-user-suspend-duration">
          {moderationCopy.durationLabel}
        </Field.Label>
        <Select.Root bind:value={suspendDuration} type="single">
          <Select.Trigger
            aria-label={moderationCopy.durationLabel}
            class="w-full"
            id="admin-user-suspend-duration"
          >
            {suspendDurationOptions.find(
              (option) => option.value === suspendDuration,
            )?.label ?? suspendDurationOptions[0]?.label ?? ""}
          </Select.Trigger>
          <Select.Content>
            <Select.Group>
              {#each suspendDurationOptions as option}
                <Select.Item label={option.label} value={option.value}>
                  {option.label}
                </Select.Item>
              {/each}
            </Select.Group>
          </Select.Content>
        </Select.Root>
      </Field.Field>
      {#if suspendDuration === "custom"}
        <Field.Field>
          <Field.Title>{moderationCopy.suspendExpires}</Field.Title>
          <DateTimePicker
            bind:value={suspendExpiresAt}
            calendarButtonLabel={moderationCopy.calendarButtonLabel}
            placeholder={moderationCopy.suspendExpires}
          />
        </Field.Field>
      {/if}
    </Field.Group>
    <Field.Field>
      <Field.Label for="admin-user-suspend-reason">
        {moderationCopy.reason}
      </Field.Label>
      <Input
        id="admin-user-suspend-reason"
        placeholder={moderationCopy.suspendReason}
        value={suspendReason}
        oninput={(event: Event) => (suspendReason = inputValue(event))}
      />
    </Field.Field>
  </Field.Set>
  <div class="flex flex-wrap gap-3">
    <Button
      disabled={isSuspending}
      type="button"
      variant="destructive"
      onclick={suspendSelectedUser}
    >
      <ShieldAlertIcon data-icon="inline-start" />
      <span>
        {isSuspending ? copy.suspending : moderationCopy.suspendAction}
      </span>
    </Button>
    {#if selectedUser.activeSuspension}
      <Button
        disabled={isLiftingSuspension}
        type="button"
        variant="outline"
        onclick={liftSelectedSuspension}
      >
        <CheckCircleIcon data-icon="inline-start" />
        <span>
          {isLiftingSuspension ? copy.lifting : copy.liftSuspensionAction}
        </span>
      </Button>
    {/if}
  </div>
</section>
