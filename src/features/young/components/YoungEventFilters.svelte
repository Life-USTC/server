<script lang="ts">
import { untrack } from "svelte";
import type { AppPageCopy } from "@/lib/shell/page-copy";
import { page } from "$app/stores";
import ActiveFilters from "$lib/components/ActiveFilters.svelte";
import FilterToolbar from "$lib/components/FilterToolbar.svelte";
import SearchField from "$lib/components/SearchField.svelte";
import { Button } from "$lib/components/ui/button";
import * as Field from "$lib/components/ui/field";
import * as NativeSelect from "$lib/components/ui/native-select";
import { removeYoungFilter } from "../lib/young-navigation";
import type { YoungOrganizerSummary } from "../server/young-event-service";
import type { YoungEventsPageFilters } from "../server/young-page-load";

let {
  copy,
  filters,
  organizers,
  categories,
  calendar,
}: {
  copy: AppPageCopy;
  filters: YoungEventsPageFilters;
  organizers: Pick<YoungOrganizerSummary, "id" | "name">[];
  categories: string[];
  calendar?: { view: "day" | "week" | "month"; date: string };
} = $props();

const labels = $derived(copy.youngEvents);
const action = $derived(
  calendar ? "/catalog/young-events/calendar" : "/catalog/young-events",
);
const prefix = $derived(calendar ? "young-calendar" : "young-event");
const clearHref = $derived(
  calendar ? `${action}?${new URLSearchParams(calendar)}` : action,
);
const modules = ["德", "智", "体", "美", "劳"];
const levels = ["班级", "院级", "校级", "省级", "国家级"];
const advancedKeys = [
  "organizerId",
  "category",
  "module",
  "activityLevel",
] as const;
let open = $state(false);
let searchDraft = $state(untrack(() => filters.search ?? ""));
let activeDraft = $state(
  untrack(() => (filters.active == null ? "" : String(filters.active))),
);
let timeBasisDraft = $state(untrack(() => filters.timeBasis ?? "activity"));
let advancedDraft = $state({
  organizerId: "",
  category: "",
  module: "",
  activityLevel: "",
});

// URL changes establish the applied state. Typing alone never updates filters.
$effect(() => {
  searchDraft = filters.search ?? "";
  activeDraft = filters.active == null ? "" : String(filters.active);
  timeBasisDraft = filters.timeBasis ?? "activity";
  open = false;
});
// Reopening the sheet discards canceled advanced edits while keeping the main search draft.
$effect(() => {
  if (open) {
    advancedDraft = {
      organizerId: filters.organizerId ?? "",
      category: filters.category ?? "",
      module: filters.module ?? "",
      activityLevel: filters.activityLevel ?? "",
    };
  }
});
const activeCount = $derived(
  advancedKeys.filter((key) => Boolean(filters[key])).length,
);
const activeFilters = $derived(
  [
    { key: "search", label: filters.search },
    {
      key: "active",
      label:
        filters.active == null
          ? null
          : filters.active
            ? labels.statusActive
            : labels.statusEnded,
    },
    {
      key: "organizerId",
      label: filters.organizerId
        ? (organizers.find((item) => item.id === filters.organizerId)?.name ??
          filters.organizerId)
        : null,
    },
    { key: "category", label: filters.category },
    { key: "module", label: filters.module },
    { key: "activityLevel", label: filters.activityLevel },
    {
      key: "dateUnknown",
      label:
        filters.dateUnknown == null
          ? null
          : filters.dateUnknown
            ? filters.timeBasis === "registration"
              ? labels.dateUnknownRegistration
              : labels.dateUnknownActivity
            : filters.timeBasis === "registration"
              ? labels.dateKnownRegistration
              : labels.dateKnownActivity,
    },
  ]
    .filter((item): item is { key: string; label: string } =>
      Boolean(item.label),
    )
    .map((item) => ({
      href: removeYoungFilter($page.url, item.key),
      label: item.label,
      removeLabel: labels.removeFilter.replace("{value}", item.label),
    })),
);
</script>

{#snippet browseContext()}
  {#if calendar}
    <input type="hidden" name="view" value={calendar.view} />
    <input type="hidden" name="date" value={calendar.date} />
  {/if}
  {#if filters.dateUnknown != null}<input type="hidden" name="dateUnknown" value={String(filters.dateUnknown)} />{/if}
{/snippet}

<FilterToolbar bind:open {activeCount} filterTitle={labels.moreFilters} filterDescription={labels.description}>
  {#snippet primary()}
    <form {action} method="get">
      <Field.FieldGroup class="flex-row flex-wrap items-end gap-3">
      {@render browseContext()}
      {#each advancedKeys as key}
        {#if filters[key]}<input type="hidden" name={key} value={filters[key]} />{/if}
      {/each}
      <div class="min-w-48 flex-1">
        <SearchField id={`${prefix}-search`} label={copy.common.search} name="search" placeholder={labels.searchPlaceholder} bind:value={searchDraft} />
      </div>
      <Field.Field class="w-auto">
        <Field.FieldLabel for={`${prefix}-active`}>{labels.signupStatus}</Field.FieldLabel>
        <NativeSelect.Root class="[&_select]:h-11" id={`${prefix}-active`} name="active" bind:value={activeDraft}>
          <NativeSelect.Option value="">{labels.statusAll}</NativeSelect.Option>
          <NativeSelect.Option value="true">{labels.statusActive}</NativeSelect.Option>
          <NativeSelect.Option value="false">{labels.statusEnded}</NativeSelect.Option>
        </NativeSelect.Root>
      </Field.Field>
      {#if calendar}
        <Field.Field class="w-auto">
          <Field.FieldLabel for="young-calendar-time-basis">{labels.timeBasis}</Field.FieldLabel>
          <NativeSelect.Root class="[&_select]:h-11" id="young-calendar-time-basis" name="timeBasis" bind:value={timeBasisDraft}>
            <NativeSelect.Option value="activity">{labels.eventTime}</NativeSelect.Option>
            <NativeSelect.Option value="registration">{labels.signupWindow}</NativeSelect.Option>
          </NativeSelect.Root>
        </Field.Field>
      {:else}
        <input type="hidden" name="timeBasis" value={timeBasisDraft} />
      {/if}
      <Button type="submit" class="h-11">{copy.common.search}</Button>
      </Field.FieldGroup>
    </form>
  {/snippet}
  {#snippet advanced()}
    <form {action} method="get" class="grid gap-5">
      {@render browseContext()}
      <input type="hidden" name="search" value={searchDraft} />
      <input type="hidden" name="active" value={activeDraft} />
      <input type="hidden" name="timeBasis" value={timeBasisDraft} />
      {#if searchDraft}<p class="text-sm text-muted-foreground">{copy.common.search}: {searchDraft}</p>{/if}
      <Field.FieldGroup>
        <Field.Field>
          <Field.FieldLabel for={`${prefix}-organizer`}>{labels.organizerFilter}</Field.FieldLabel>
          <NativeSelect.Root class="[&_select]:h-11" id={`${prefix}-organizer`} name="organizerId" bind:value={advancedDraft.organizerId}>
            <NativeSelect.Option value="">{labels.allOrganizers}</NativeSelect.Option>
            {#if advancedDraft.organizerId && !organizers.some((item) => item.id === advancedDraft.organizerId)}<NativeSelect.Option value={advancedDraft.organizerId}>{advancedDraft.organizerId}</NativeSelect.Option>{/if}
            {#each organizers as organizer (organizer.id)}<NativeSelect.Option value={organizer.id}>{organizer.name}</NativeSelect.Option>{/each}
          </NativeSelect.Root>
        </Field.Field>
        <Field.Field>
          <Field.FieldLabel for={`${prefix}-category`}>{labels.category}</Field.FieldLabel>
          <NativeSelect.Root class="[&_select]:h-11" id={`${prefix}-category`} name="category" bind:value={advancedDraft.category}>
            <NativeSelect.Option value="">{labels.allCategories}</NativeSelect.Option>
            {#if advancedDraft.category && !categories.includes(advancedDraft.category)}<NativeSelect.Option value={advancedDraft.category}>{advancedDraft.category}</NativeSelect.Option>{/if}
            {#each categories as category (category)}<NativeSelect.Option value={category}>{category}</NativeSelect.Option>{/each}
          </NativeSelect.Root>
        </Field.Field>
        <Field.Field>
          <Field.FieldLabel for={`${prefix}-module`}>{labels.module}</Field.FieldLabel>
          <NativeSelect.Root class="[&_select]:h-11" id={`${prefix}-module`} name="module" bind:value={advancedDraft.module}>
            <NativeSelect.Option value="">{labels.allModules}</NativeSelect.Option>
            {#if advancedDraft.module && !modules.includes(advancedDraft.module)}<NativeSelect.Option value={advancedDraft.module}>{advancedDraft.module}</NativeSelect.Option>{/if}
            {#each modules as module (module)}<NativeSelect.Option value={module}>{module}</NativeSelect.Option>{/each}
          </NativeSelect.Root>
        </Field.Field>
        <Field.Field>
          <Field.FieldLabel for={`${prefix}-activity-level`}>{labels.activityLevel}</Field.FieldLabel>
          <NativeSelect.Root class="[&_select]:h-11" id={`${prefix}-activity-level`} name="activityLevel" bind:value={advancedDraft.activityLevel}>
            <NativeSelect.Option value="">{labels.allActivityLevels}</NativeSelect.Option>
            {#if advancedDraft.activityLevel && !levels.includes(advancedDraft.activityLevel)}<NativeSelect.Option value={advancedDraft.activityLevel}>{advancedDraft.activityLevel}</NativeSelect.Option>{/if}
            {#each levels as level (level)}<NativeSelect.Option value={level}>{level}</NativeSelect.Option>{/each}
          </NativeSelect.Root>
        </Field.Field>
      </Field.FieldGroup>
      <Button type="submit" class="h-11">{copy.common.search}</Button>
    </form>
  {/snippet}
</FilterToolbar>
<ActiveFilters items={activeFilters} ariaLabel={labels.activeFilters} {clearHref} clearLabel={copy.common.clear} />
