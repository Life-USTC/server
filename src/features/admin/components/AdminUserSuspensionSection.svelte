<script lang="ts">
import CheckCircleIcon from "@lucide/svelte/icons/check-circle";
import ShieldAlertIcon from "@lucide/svelte/icons/shield-alert";
import DateTimePicker from "$lib/components/DateTimePicker.svelte";
import { Badge } from "$lib/components/ui/badge/index.js";
import { Button } from "$lib/components/ui/button/index.js";
import * as Field from "$lib/components/ui/field/index.js";
import { Input } from "$lib/components/ui/input/index.js";
import * as NativeSelect from "$lib/components/ui/native-select/index.js";
import { Spinner } from "$lib/components/ui/spinner/index.js";
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

<Field.Set class="rounded-lg border border-border bg-muted/30 p-3">
  <Field.Legend class="flex flex-wrap items-center gap-2 text-destructive">
    <span>{copy.suspendTitle}</span>
    {#if selectedUser.activeSuspension}
      <Badge variant="destructive">
        {suspensionLabel(selectedUser)}
      </Badge>
    {/if}
  </Field.Legend>
  <Field.Description>{copy.suspendDescription}</Field.Description>
  <Field.Group>
    <Field.Group class="grid gap-4 sm:grid-cols-2">
      <Field.Field>
        <Field.Label for="admin-user-suspend-duration">
          {moderationCopy.durationLabel}
        </Field.Label>
        <NativeSelect.Root
          aria-label={moderationCopy.durationLabel}
          bind:value={suspendDuration}
          class="w-full"
          id="admin-user-suspend-duration"
        >
          {#each suspendDurationOptions as option}
            <NativeSelect.Option value={option.value}>
              {option.label}
            </NativeSelect.Option>
          {/each}
        </NativeSelect.Root>
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
  </Field.Group>
  <div class="flex flex-wrap gap-3">
    <Button
      disabled={isSuspending}
      type="button"
      variant="destructive"
      onclick={suspendSelectedUser}
    >
      {#if isSuspending}
        <Spinner data-icon="inline-start" />
      {:else}
        <ShieldAlertIcon data-icon="inline-start" />
      {/if}
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
        {#if isLiftingSuspension}
          <Spinner data-icon="inline-start" />
        {:else}
          <CheckCircleIcon data-icon="inline-start" />
        {/if}
        <span>
          {isLiftingSuspension ? copy.lifting : copy.liftSuspensionAction}
        </span>
      </Button>
    {/if}
  </div>
</Field.Set>
