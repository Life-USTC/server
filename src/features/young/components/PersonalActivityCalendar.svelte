<script lang="ts">
import type { AppPageCopy } from "@/lib/shell/page-copy";
import { shanghaiDayjs } from "@/lib/time/shanghai-dayjs";
import CalendarAgenda from "$lib/components/calendar/CalendarAgenda.svelte";
import CalendarGrid from "$lib/components/calendar/CalendarGrid.svelte";
import {
  toolbarControlClass,
  toolbarFieldClass,
} from "$lib/components/toolbar-control";
import { Button } from "$lib/components/ui/button";
import * as Field from "$lib/components/ui/field";
import { Input } from "$lib/components/ui/input";
import * as ToggleGroup from "$lib/components/ui/toggle-group";
import {
  fetchPersonalCalendar,
  type PersonalCalendarItem,
  personalItemsForDay,
} from "../lib/personal-calendar-client";

let {
  copy,
  locale,
  ownerId,
}: {
  copy: AppPageCopy;
  locale: string;
  ownerId: string;
} = $props();
let selectedDate = $state(shanghaiDayjs().format("YYYY-MM-DD"));
let view = $state("week");
let items = $state<PersonalCalendarItem[]>([]);
let loading = $state(true);
let itemsOwnerId = $state("");
let itemsLocale = $state("");
const visibleItems = $derived(
  itemsOwnerId === ownerId && itemsLocale === locale ? items : [],
);
let failed = $state(false);
let refresh = $state(0);
const text = $derived(copy.youngEvents.workspace);
const range = $derived.by(() => {
  const selected = shanghaiDayjs(selectedDate);
  if (view === "day") return { start: selected, count: 1 };
  const start = view === "month" ? selected.startOf("month") : selected;
  const monday = start.subtract((start.day() + 6) % 7, "day");
  return {
    start: monday,
    count:
      view === "month"
        ? Math.ceil((selected.endOf("month").diff(monday, "day") + 1) / 7) * 7
        : 7,
  };
});
const days = $derived(
  Array.from({ length: range.count }, (_, index) => {
    const date = range.start.add(index, "day");
    const key = date.format("YYYY-MM-DD");
    return {
      key,
      dateLabel: date.format("MM-DD"),
      weekdayLabel: new Intl.DateTimeFormat(locale, {
        weekday: "long",
        timeZone: "Asia/Shanghai",
      }).format(date.toDate()),
      isToday: key === shanghaiDayjs().format("YYYY-MM-DD"),
      events: personalItemsForDay(visibleItems, key),
    };
  }),
);
const weeks = $derived(
  Array.from({ length: Math.ceil(days.length / 7) }, (_, index) => ({
    days: days
      .slice(index * 7, index * 7 + 7)
      .map((day) => ({ ...day, label: day.dateLabel })),
  })),
);
const weekdays = $derived(days.slice(0, 7).map((day) => day.weekdayLabel));
$effect(() => {
  const start = range.start.format("YYYY-MM-DD");
  const end = range.start.add(range.count - 1, "day").format("YYYY-MM-DD");
  void refresh;
  const requestOwnerId = ownerId;
  const requestLocale = locale;
  const controller = new AbortController();
  loading = true;
  failed = false;
  items = [];
  itemsOwnerId = requestOwnerId;
  itemsLocale = requestLocale;
  void fetchPersonalCalendar(start, end, controller.signal)
    .then((result) => {
      if (
        !controller.signal.aborted &&
        ownerId === requestOwnerId &&
        locale === requestLocale
      )
        items = result;
    })
    .catch(() => {
      if (
        !controller.signal.aborted &&
        ownerId === requestOwnerId &&
        locale === requestLocale
      )
        failed = true;
    })
    .finally(() => {
      if (
        !controller.signal.aborted &&
        ownerId === requestOwnerId &&
        locale === requestLocale
      )
        loading = false;
    });
  return () => controller.abort();
});
function move(direction: number) {
  selectedDate = shanghaiDayjs(selectedDate)
    .add(
      direction,
      view === "month" ? "month" : view === "week" ? "week" : "day",
    )
    .format("YYYY-MM-DD");
}
</script>

<section class="grid gap-4" aria-label={text.calendar}>
  <div class="flex flex-wrap items-end gap-3">
    <Field.Field class="w-auto"><Field.FieldLabel for="personal-activity-date">{text.calendar}</Field.FieldLabel><Input id="personal-activity-date" class={toolbarFieldClass} type="date" value={selectedDate} onchange={(event) => { if (event.currentTarget.value) selectedDate = event.currentTarget.value; }} /></Field.Field>
    <ToggleGroup.Root type="single" bind:value={() => view, (value) => { if (value) view = value; }} variant="outline" aria-label={text.calendar}>
      <ToggleGroup.Item value="day">{text.day}</ToggleGroup.Item><ToggleGroup.Item value="week">{text.week}</ToggleGroup.Item><ToggleGroup.Item value="month">{text.month}</ToggleGroup.Item>
    </ToggleGroup.Root>
    <Button variant="outline" class={toolbarControlClass} onclick={() => move(-1)}>{copy.common.previous}</Button>
    <Button variant="outline" class={toolbarControlClass} onclick={() => selectedDate = shanghaiDayjs().format("YYYY-MM-DD")}>{copy.workspace.todayAction}</Button>
    <Button variant="outline" class={toolbarControlClass} onclick={() => move(1)}>{copy.common.next}</Button>
    <Button href="/workspace/subscriptions/activities" variant="link">{text.manage}</Button>
  </div>
  {#if loading || itemsOwnerId !== ownerId || itemsLocale !== locale}<p role="status">{text.loading}</p>
  {:else if failed}<p role="alert">{text.failed}</p><Button variant="outline" onclick={() => refresh++}>{text.retry}</Button>
  {:else}
    <div class={view === "day" ? "" : "md:hidden"}><CalendarAgenda {days} emptyLabel={text.empty} label={text.calendar} todayLabel={copy.workspace.todayAction} /></div>
    {#if view !== "day"}<div class="hidden md:block"><CalendarGrid {weeks} {weekdays} variant={view === "month" ? "month" : "week"} minWidth="760px" eventLimit={view === "week" ? 8 : 4} /></div>{/if}
  {/if}
</section>
