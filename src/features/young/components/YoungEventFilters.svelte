<script lang="ts">
import ActiveFilters from "#lib/components/ActiveFilters.svelte";
import SearchField from "#lib/components/SearchField.svelte";
import TableColumnHeader from "#lib/components/TableColumnHeader.svelte";
import { Button } from "#lib/components/ui/button/index.js";
import * as Field from "#lib/components/ui/field/index.js";
import * as NativeSelect from "#lib/components/ui/native-select/index.js";
import type { AppPageCopy } from "@/lib/shell/page-copy";
import { page } from "$app/state";
import { removeYoungFilter } from "../lib/young-navigation";
import type { YoungOrganizerSummary } from "../server/young-event-service";
import type { YoungEventsPageFilters } from "../server/young-page-load";

let {
  copy,
  filters,
  organizers,
  categories,
  mode,
  prefix,
  searchDraft = $bindable(""),
}: {
  copy: AppPageCopy;
  filters: YoungEventsPageFilters;
  organizers: Pick<YoungOrganizerSummary, "id" | "name">[];
  categories: string[];
  mode: "search" | "metadata" | "status";
  prefix: string;
  searchDraft?: string;
} = $props();

const labels = $derived(copy.youngEvents);
const action = "/catalog/young-events";
const modules = ["德", "智", "体", "美", "劳"];
const levels = ["班级", "院级", "校级", "省级", "国家级"];
const advancedKeys = [
  "organizerId",
  "category",
  "module",
  "activityLevel",
] as const;
let open = $state(false);
let activeDraft = $state("");
let advancedDraft = $state({
  organizerId: "",
  category: "",
  module: "",
  activityLevel: "",
});

$effect(() => {
  if (open) {
    activeDraft = filters.active == null ? "" : String(filters.active);
    advancedDraft = {
      organizerId: filters.organizerId ?? "",
      category: filters.category ?? "",
      module: filters.module ?? "",
      activityLevel: filters.activityLevel ?? "",
    };
  }
});
const unknownModule = $derived(
  Boolean(advancedDraft.module) && !modules.includes(advancedDraft.module),
);
const unknownLevel = $derived(
  Boolean(advancedDraft.activityLevel) &&
    !levels.includes(advancedDraft.activityLevel),
);
const appliedParams = $derived({
  search: searchDraft,
  active: filters.active == null ? "" : String(filters.active),
  timeBasis: filters.timeBasis ?? "activity",
  dateUnknown: filters.dateUnknown == null ? "" : String(filters.dateUnknown),
  organizerId: filters.organizerId ?? "",
  category: filters.category ?? "",
  module: filters.module ?? "",
  activityLevel: filters.activityLevel ?? "",
});
const omitted = $derived<string[]>(
  mode === "search"
    ? ["search"]
    : mode === "status"
      ? ["active"]
      : [...advancedKeys],
);
const hidden = $derived(
  Object.entries(appliedParams).filter(
    ([key, value]) => !omitted.includes(key) && value !== "",
  ),
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
      href: removeYoungFilter(new URL(page.url.href), item.key),
      label: item.label,
      removeLabel: labels.removeFilter.replace("{value}", () => item.label),
    })),
);
</script>

{#snippet preserved()}
  {#each hidden as [name, value]}<input type="hidden" {name} {value} />{/each}
{/snippet}

{#if mode === "search"}
  <div class="grid w-full min-w-0 gap-3">
    <form {action} method="get" class="flex min-w-0 items-center gap-2">
      {@render preserved()}
      <SearchField id={prefix + "-search"} label={copy.common.search} name="search" placeholder={labels.searchPlaceholder} bind:value={searchDraft} />
      <Button type="submit">{copy.common.search}</Button>
    </form>
    <ActiveFilters items={activeFilters} ariaLabel={labels.activeFilters} clearHref={action} clearLabel={copy.common.clear} />
  </div>
{:else}
  <TableColumnHeader
    label={mode === "status" ? labels.status : labels.eventName}
    active={mode === "status" ? filters.active != null : advancedKeys.some((key) => Boolean(filters[key]))}
    bind:open
  >
    <form {action} method="get">
      {@render preserved()}
      <Field.Group class="gap-3">
        {#if mode === "status"}
          <Field.Field>
            <Field.Label for={prefix + "-active"}>{labels.signupStatus}</Field.Label>
            <NativeSelect.Root id={prefix + "-active"} name="active" bind:value={activeDraft} class="w-full">
              <NativeSelect.Option value="">{labels.statusAll}</NativeSelect.Option>
              <NativeSelect.Option value="true">{labels.statusActive}</NativeSelect.Option>
              <NativeSelect.Option value="false">{labels.statusEnded}</NativeSelect.Option>
            </NativeSelect.Root>
          </Field.Field>
        {:else}
          <Field.Field>
            <Field.Label for={prefix + "-organizer"}>{labels.organizerFilter}</Field.Label>
            <NativeSelect.Root id={prefix + "-organizer"} name="organizerId" bind:value={advancedDraft.organizerId} class="w-full">
              <NativeSelect.Option value="">{labels.allOrganizers}</NativeSelect.Option>
              {#if advancedDraft.organizerId && !organizers.some((item) => item.id === advancedDraft.organizerId)}<NativeSelect.Option value={advancedDraft.organizerId}>{advancedDraft.organizerId}</NativeSelect.Option>{/if}
              {#each organizers as organizer (organizer.id)}<NativeSelect.Option value={organizer.id}>{organizer.name}</NativeSelect.Option>{/each}
            </NativeSelect.Root>
          </Field.Field>
          <Field.Field>
            <Field.Label for={prefix + "-category"}>{labels.category}</Field.Label>
            <NativeSelect.Root id={prefix + "-category"} name="category" bind:value={advancedDraft.category} class="w-full">
              <NativeSelect.Option value="">{labels.allCategories}</NativeSelect.Option>
              {#if advancedDraft.category && !categories.includes(advancedDraft.category)}<NativeSelect.Option value={advancedDraft.category}>{advancedDraft.category}</NativeSelect.Option>{/if}
              {#each categories as category (category)}<NativeSelect.Option value={category}>{category}</NativeSelect.Option>{/each}
            </NativeSelect.Root>
          </Field.Field>
          <Field.Field>
            <Field.Label for={prefix + "-module"}>{labels.module}</Field.Label>
            {#if unknownModule}<input type="hidden" name="module" value={advancedDraft.module} />{/if}
            <NativeSelect.Root id={prefix + "-module"} name={unknownModule ? undefined : "module"} bind:value={advancedDraft.module} class="w-full">
              <NativeSelect.Option value="">{labels.allModules}</NativeSelect.Option>
              {#if unknownModule}<NativeSelect.Option value={advancedDraft.module} disabled>{advancedDraft.module}</NativeSelect.Option>{/if}
              {#each modules as module (module)}<NativeSelect.Option value={module}>{module}</NativeSelect.Option>{/each}
            </NativeSelect.Root>
          </Field.Field>
          <Field.Field>
            <Field.Label for={prefix + "-activity-level"}>{labels.activityLevel}</Field.Label>
            {#if unknownLevel}<input type="hidden" name="activityLevel" value={advancedDraft.activityLevel} />{/if}
            <NativeSelect.Root id={prefix + "-activity-level"} name={unknownLevel ? undefined : "activityLevel"} bind:value={advancedDraft.activityLevel} class="w-full">
              <NativeSelect.Option value="">{labels.allActivityLevels}</NativeSelect.Option>
              {#if unknownLevel}<NativeSelect.Option value={advancedDraft.activityLevel} disabled>{advancedDraft.activityLevel}</NativeSelect.Option>{/if}
              {#each levels as level (level)}<NativeSelect.Option value={level}>{level}</NativeSelect.Option>{/each}
            </NativeSelect.Root>
          </Field.Field>
        {/if}
        <Button type="submit">{copy.common.search}</Button>
      </Field.Group>
    </form>
  </TableColumnHeader>
{/if}
