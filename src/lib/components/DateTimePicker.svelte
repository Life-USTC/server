<script lang="ts">
import type { CalendarDate, DateValue } from "@internationalized/date";
import CalendarIcon from "@lucide/svelte/icons/calendar";
import { untrack } from "svelte";
import { dateTimePickerCopy } from "#lib/components/date-time-picker-copy.js";
import {
  dateTimeLocalValue,
  parseDateTimeLocal,
} from "#lib/components/date-time-picker-value.js";
import { Button } from "#lib/components/ui/button/index.js";
import { Calendar } from "#lib/components/ui/calendar/index.js";
import * as Field from "#lib/components/ui/field/index.js";
import { Input } from "#lib/components/ui/input/index.js";
import * as InputGroup from "#lib/components/ui/input-group/index.js";
import * as Popover from "#lib/components/ui/popover/index.js";
import { cn } from "#lib/utils.js";
import { page } from "$app/state";

let {
  disabled = false,
  name,
  placeholder = "",
  calendarButtonLabel,
  value = $bindable(""),
  defaultTime = "23:59",
  locale,
  class: className = "",
  ...restProps
}: {
  disabled?: boolean;
  name?: string;
  placeholder?: string;
  calendarButtonLabel: string;
  value?: string;
  defaultTime?: string;
  locale?: "zh-cn" | "en-us";
  class?: string;
  [key: string]: unknown;
} = $props();

let open = $state(false);
let selectedDate = $state<CalendarDate | undefined>();
let timeValue = $state(untrack(() => defaultTime));
let lastSyncedValue = $state("");
let activeLocale = $derived(locale ?? page.data.locale ?? "zh-cn");
let pickerCopy = $derived(dateTimePickerCopy(activeLocale));
const controlId = $props.id();

function stringRestProp(name: string) {
  const value = restProps[name];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function syncFromValue(nextValue: string) {
  const parsed = parseDateTimeLocal(nextValue);
  selectedDate = parsed?.date;
  timeValue = parsed?.time ?? defaultTime;
  lastSyncedValue = nextValue;
}

function commit(nextDate = selectedDate, nextTime = timeValue) {
  value = dateTimeLocalValue(nextDate, nextTime, defaultTime);
  lastSyncedValue = value;
}

function handleDateChange(nextDate: DateValue | undefined) {
  selectedDate = nextDate as CalendarDate | undefined;
  commit();
}

function handleTimeInput(event: Event) {
  const input = event.currentTarget as HTMLInputElement;
  if (!input.validity.valid || !input.value) return;
  timeValue = input.value;
  commit();
}

function handleInput(event: Event) {
  value = (event.currentTarget as HTMLInputElement).value;
  syncFromValue(value);
}

$effect.pre(() => {
  if ((value ?? "") !== lastSyncedValue) syncFromValue(value ?? "");
});
let labelledBy = $derived(stringRestProp("aria-labelledby"));
let label = $derived(stringRestProp("aria-label") ?? placeholder);
let rootProps = $derived.by(() => {
  const {
    "aria-label": _label,
    "aria-labelledby": _labelledBy,
    ...rest
  } = restProps;
  return rest;
});
</script>

<InputGroup.Root
  {...rootProps}
  aria-label={labelledBy ? undefined : label}
  aria-labelledby={labelledBy}
  class={cn("min-w-0", className)}
>
  <InputGroup.Input
    aria-label={labelledBy ? undefined : label}
    aria-labelledby={labelledBy}
    disabled={disabled}
    {name}
    {placeholder}
    type="datetime-local"
    step="any"
    {value}
    oninput={handleInput}
  />
  <InputGroup.Addon align="inline-end">
    <Popover.Root bind:open>
      <Popover.Trigger>
        {#snippet child({ props })}
          <InputGroup.Button
            {...props}
            aria-label={calendarButtonLabel}
            disabled={disabled}
            size="icon-xs"
            type="button"
            variant="ghost"
          >
            <CalendarIcon data-icon="inline-start" />
          </InputGroup.Button>
        {/snippet}
      </Popover.Trigger>
      <Popover.Content class="w-auto overflow-hidden p-0" align="start">
        <Calendar
          bind:value={selectedDate}
          captionLayout="dropdown"
          onValueChange={handleDateChange}
          locale={activeLocale === "zh-cn" ? "zh-CN" : "en-US"}
          previousLabel={pickerCopy.previous}
          nextLabel={pickerCopy.next}
          aria-label={calendarButtonLabel}
          type="single"
        />
        <Field.FieldGroup class="gap-3 p-3">
          <Field.Field>
            <Field.FieldLabel for={`${controlId}-time`}>
              {pickerCopy.time}
            </Field.FieldLabel>
            <Input
              id={`${controlId}-time`}
              type="time"
              step="any"
              value={timeValue}
              oninput={handleTimeInput}
              disabled={disabled || !selectedDate}
            />
          </Field.Field>
          <Button type="button" variant="outline" onclick={() => { open = false; }}>
            {pickerCopy.done}
          </Button>
        </Field.FieldGroup>
      </Popover.Content>
    </Popover.Root>
  </InputGroup.Addon>
</InputGroup.Root>
