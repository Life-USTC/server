<script lang="ts">
import DateTimePicker from "$lib/components/DateTimePicker.svelte";
import * as Field from "$lib/components/ui/field/index.js";
import { Input } from "$lib/components/ui/input/index.js";
import * as NativeSelect from "$lib/components/ui/native-select/index.js";
import { cn } from "$lib/utils.js";

type Props = {
  compact?: boolean;
  copy: {
    durationLabel: string;
    expiresLabel: string;
    reasonLabel: string;
    calendarButtonLabel: string;
  };
  idPrefix: string;
  expiresLabelId: string;
  duration: string;
  expiresAt: string;
  reason: string;
  options: ReadonlyArray<{ label: string; value: string }>;
};

let {
  compact = false,
  copy,
  idPrefix,
  expiresLabelId,
  duration = $bindable(),
  expiresAt = $bindable(),
  reason = $bindable(),
  options,
}: Props = $props();
</script>

{#snippet durationFields()}
  <Field.Field>
    <Field.Label class={cn(compact && "sr-only")} for={`${idPrefix}-duration`}>
      {copy.durationLabel}
    </Field.Label>
    <NativeSelect.Root
      aria-label={compact ? undefined : copy.durationLabel}
      bind:value={duration}
      class="w-full"
      id={`${idPrefix}-duration`}
    >
      {#each options as option}
        <NativeSelect.Option value={option.value}>{option.label}</NativeSelect.Option>
      {/each}
    </NativeSelect.Root>
  </Field.Field>
  {#if duration === "custom"}
    <Field.Field>
      <Field.Label id={expiresLabelId}>{copy.expiresLabel}</Field.Label>
      <DateTimePicker
        bind:value={expiresAt}
        aria-labelledby={expiresLabelId}
        calendarButtonLabel={copy.calendarButtonLabel}
      />
    </Field.Field>
  {/if}
{/snippet}

{#snippet reasonField()}
  <Field.Field class={cn(compact && "md:col-span-2")}>
    <Field.Label for={`${idPrefix}-reason`}>{copy.reasonLabel}</Field.Label>
    <Input id={`${idPrefix}-reason`} bind:value={reason} />
  </Field.Field>
{/snippet}

{#if compact}
  <Field.Group class="grid gap-2 md:grid-cols-[160px_1fr]">
    {@render durationFields()}
    {@render reasonField()}
  </Field.Group>
{:else}
  <Field.Group>
    <Field.Group class="grid gap-4 sm:grid-cols-2">
      {@render durationFields()}
    </Field.Group>
    {@render reasonField()}
  </Field.Group>
{/if}
