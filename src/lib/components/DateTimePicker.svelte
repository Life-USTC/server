<script lang="ts">
import type { CalendarDate, DateValue } from "@internationalized/date";
import CalendarIcon from "@lucide/svelte/icons/calendar";
import {
  dateTimeLocalValue,
  parseDateTimeLocal,
} from "$lib/components/date-time-picker-value";
import { Calendar } from "$lib/components/ui/calendar/index.js";
import * as InputGroup from "$lib/components/ui/input-group/index.js";
import * as Popover from "$lib/components/ui/popover/index.js";
import { cn } from "$lib/utils.js";

export let disabled = false;
export let name: string | undefined = undefined;
export let placeholder = "";
export let calendarButtonLabel: string;
export let value = "";
export let defaultTime = "23:59";
let className = "";

export { className as class };

let open = false;
let selectedDate: CalendarDate | undefined;
let timeValue = defaultTime;
let lastSyncedValue = "";
let rootProps: Record<string, unknown> = {};

function stringRestProp(name: string) {
  const value = ($$restProps as Record<string, unknown>)[name];
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
  open = false;
}

function handleInput(event: Event) {
  value = (event.currentTarget as HTMLInputElement).value;
  syncFromValue(value);
}

$: if ((value ?? "") !== lastSyncedValue) {
  syncFromValue(value ?? "");
}
$: labelledBy = stringRestProp("aria-labelledby");
$: label = stringRestProp("aria-label") ?? placeholder;
$: {
  const {
    "aria-label": _label,
    "aria-labelledby": _labelledBy,
    ...rest
  } = $$restProps as Record<string, unknown>;
  rootProps = rest;
}
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
    class="font-mono"
    disabled={disabled}
    {name}
    {placeholder}
    type="text"
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
          type="single"
        />
      </Popover.Content>
    </Popover.Root>
  </InputGroup.Addon>
</InputGroup.Root>
