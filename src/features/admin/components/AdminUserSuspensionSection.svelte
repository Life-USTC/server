<script lang="ts">
import DateTimePicker from "$lib/components/DateTimePicker.svelte";
import CheckCircleIcon from "$lib/components/icons/check-circle.svelte";
import ShieldAlertIcon from "$lib/components/icons/shield-alert.svelte";
import { Badge } from "$lib/components/ui/badge/index.js";
import { Button } from "$lib/components/ui/button/index.js";
import { Input } from "$lib/components/ui/input/index.js";
import { Select } from "$lib/components/ui/select/index.js";
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
  <div>
    <div class="flex flex-wrap items-center gap-2">
      <h3 class="font-medium text-error">{copy.suspendTitle}</h3>
      {#if selectedUser.activeSuspension}
        <Badge class="border-warning bg-warning/10 text-warning" variant="outline">
          {suspensionLabel(selectedUser)}
        </Badge>
      {/if}
    </div>
    <p class="text-base-content/60 text-sm">{copy.suspendDescription}</p>
  </div>
  <div class="grid gap-4 sm:grid-cols-2">
    <label class="grid gap-2">
      <span class="font-medium text-sm">{moderationCopy.durationLabel}</span>
      <Select
        items={suspendDurationOptions}
        value={suspendDuration}
        onchange={(event) => (suspendDuration = event.currentTarget.value)}
      />
    </label>
    {#if suspendDuration === "custom"}
      <label class="grid gap-2">
        <span class="font-medium text-sm">{moderationCopy.suspendExpires}</span>
        <DateTimePicker
          bind:value={suspendExpiresAt}
          placeholder={moderationCopy.suspendExpires}
        />
      </label>
    {/if}
  </div>
  <label class="grid gap-2">
    <span class="font-medium text-sm">{moderationCopy.reason}</span>
    <Input
      placeholder={moderationCopy.suspendReason}
      value={suspendReason}
      oninput={(event: Event) => (suspendReason = inputValue(event))}
    />
  </label>
  <div class="flex flex-wrap gap-3">
    <Button
      class="border-transparent bg-error text-error-content hover:bg-error/90"
      disabled={isSuspending}
      type="button"
      onclick={suspendSelectedUser}
    >
      <ShieldAlertIcon />
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
        <CheckCircleIcon />
        <span>
          {isLiftingSuspension ? copy.lifting : copy.liftSuspensionAction}
        </span>
      </Button>
    {/if}
  </div>
</section>
