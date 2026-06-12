<script lang="ts">
import type { CalendarDate, DateValue } from "@internationalized/date";
import CalendarIcon from "@lucide/svelte/icons/calendar";
import {
  dateTimeLocalValue,
  parseDateTimeLocal,
} from "$lib/components/date-time-picker-value";
import { Button } from "$lib/components/ui/button/index.js";
import { Calendar } from "$lib/components/ui/calendar/index.js";
import { Input } from "$lib/components/ui/input/index.js";
import * as Popover from "$lib/components/ui/popover/index.js";
import { cn } from "$lib/utils.js";

export let disabled = false;
export let name: string | undefined = undefined;
export let placeholder = "";
export let value = "";
export let defaultTime = "23:59";
let className = "";

export { className as class };

let open = false;
let selectedDate: CalendarDate | undefined;
let timeValue = defaultTime;
let lastSyncedValue = "";

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
</script>

<div class={cn("relative min-w-0", className)}>
  <Input
    aria-label={placeholder}
    class="pe-10 font-mono"
    disabled={disabled}
    {name}
    {placeholder}
    type="text"
    {value}
    oninput={handleInput}
  />
  <Popover.Root bind:open>
    <Popover.Trigger>
      {#snippet child({ props })}
        <Button
          {...props}
          aria-label="Select date"
          class="absolute end-1 top-1/2 size-7 -translate-y-1/2"
          disabled={disabled}
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          <CalendarIcon class="size-4" />
        </Button>
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
</div>
