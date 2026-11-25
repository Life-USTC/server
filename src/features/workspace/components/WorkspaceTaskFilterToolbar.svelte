<script lang="ts">
import ChevronDown from "@lucide/svelte/icons/chevron-down";
import SlidersHorizontal from "@lucide/svelte/icons/sliders-horizontal";
import { onMount } from "svelte";
import ActiveFilters from "#lib/components/ActiveFilters.svelte";
import FilterActions from "#lib/components/FilterActions.svelte";
import FilterToolbar from "#lib/components/FilterToolbar.svelte";
import SearchField from "#lib/components/SearchField.svelte";
import TableFilterFields from "#lib/components/TableFilterFields.svelte";
import { Button } from "#lib/components/ui/button/index.js";
import * as Popover from "#lib/components/ui/popover/index.js";
import type { TableFilterField } from "@/lib/table-filters";
import type { WorkspaceCommonCopy } from "../lib/workspace-controller-types";
import {
  taskFilterSummary,
  withoutTaskFilter,
} from "../lib/workspace-task-filter-state";

let {
  id,
  fields,
  commonNames,
  draft = $bindable(),
  applied = $bindable(),
  copy,
  sortLabel,
  onreset,
}: {
  id: string;
  fields: TableFilterField[];
  commonNames: string[];
  draft: Record<string, string>;
  applied: Record<string, string>;
  copy: WorkspaceCommonCopy;
  sortLabel: string;
  onreset: () => void;
} = $props();
function onchange(patch: Record<string, string>) {
  draft = { ...draft, ...patch };
}
function applyFilters(event: SubmitEvent) {
  event.preventDefault();
  applied = { ...draft };
}
function removeFilter(name: string) {
  draft = withoutTaskFilter(draft, name);
  applied = withoutTaskFilter(applied, name);
}
let ready = $state(false);
onMount(() => {
  ready = true;
});
const common = $derived(
  commonNames.flatMap((name) => fields.filter((field) => field.name === name)),
);
const more = $derived(
  fields.filter(
    (field) => field.name !== "title" && !commonNames.includes(field.name),
  ),
);
const active = $derived(
  fields.flatMap((field) => {
    const summary = taskFilterSummary(field, applied, copy.tableFilters);
    if (!summary) return [];
    const label = `${field.label}: ${summary}`;
    return [
      {
        key: field.name,
        label,
        removeLabel: `${copy.taskFilters.remove}: ${label}`,
        remove: () => removeFilter(field.name),
      },
    ];
  }),
);
</script>

{#snippet filterMenu(label: string, trigger: string, menuFields: TableFilterField[], isMore: boolean)}
  <Popover.Root modal="trap-focus">
    <Popover.Trigger>
      {#snippet render({props})}
        <Button {...props} type="button" variant="outline" disabled={!ready} data-filter-trigger={trigger}>
          {#if isMore}<SlidersHorizontal data-icon="inline-start" />{/if}
          {label}
          {#if !isMore}<ChevronDown data-icon="inline-end" />{/if}
        </Button>
      {/snippet}
    </Popover.Trigger>
    <Popover.Content aria-label={label} role="dialog" align={isMore ? "end" : "start"} class="max-h-[70dvh] w-80 max-w-[calc(100vw-2rem)] overflow-y-auto">
      <TableFilterFields fields={menuFields} values={draft} {onchange} labels={copy.tableFilters} idPrefix={`${id}-${isMore ? "more" : "common"}`} formId={id} />
    </Popover.Content>
  </Popover.Root>
{/snippet}

<div class="flex min-w-0 flex-col gap-3" data-slot="workspace-task-filter-toolbar">
  <form {id} onsubmit={applyFilters} data-slot="table-filter-apply">
    <FilterToolbar>
      {#snippet primary()}
        <div class="w-full min-w-0 md:w-auto md:min-w-48 md:flex-1">
          <SearchField id={`${id}-search`} label={copy.taskFilters.search} placeholder={copy.taskFilters.search} value={draft.title ?? ""} oninput={(event) => onchange({title:event.currentTarget.value})} disabled={!ready} />
        </div>
        {#each common as field (field.name)}
          {@render filterMenu(field.label, field.name, [field], false)}
        {/each}
        {@render filterMenu(copy.taskFilters.more, "more", more, true)}
      {/snippet}
      {#snippet actions()}
        <FilterActions applyLabel={copy.applyFilters} resetLabel={copy.taskFilters.reset} {onreset} disabled={!ready} />
      {/snippet}
    </FilterToolbar>
  </form>
  <ActiveFilters items={active} ariaLabel={copy.taskFilters.applied} clearLabel={copy.taskFilters.remove} showLabel disabled={!ready} />
  <p class="text-sm text-muted-foreground" data-slot="workspace-task-sort">{sortLabel}</p>
</div>
