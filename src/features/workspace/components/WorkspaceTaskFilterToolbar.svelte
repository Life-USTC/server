<script lang="ts">
import ChevronDown from "@lucide/svelte/icons/chevron-down";
import SlidersHorizontal from "@lucide/svelte/icons/sliders-horizontal";
import X from "@lucide/svelte/icons/x";
import { onMount } from "svelte";
import SearchField from "#lib/components/SearchField.svelte";
import TableFilterFields from "#lib/components/TableFilterFields.svelte";
import { Button } from "#lib/components/ui/button/index.js";
import * as Popover from "#lib/components/ui/popover/index.js";
import type { TableFilterField } from "@/lib/table-filters";
import type { WorkspaceCommonCopy } from "../lib/workspace-controller-types";
import { taskFilterSummary } from "../lib/workspace-task-filter-state";

let {
  id,
  fields,
  commonNames,
  draft,
  applied,
  copy,
  sortLabel,
  onchange,
  onapply,
  onreset,
  onremove,
}: {
  id: string;
  fields: TableFilterField[];
  commonNames: string[];
  draft: Record<string, string>;
  applied: Record<string, string>;
  copy: WorkspaceCommonCopy;
  sortLabel: string;
  onchange: (patch: Record<string, string>) => void;
  onapply: (event: SubmitEvent) => void;
  onreset: () => void;
  onremove: (name: string) => void;
} = $props();
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
    return summary
      ? [{ name: field.name, label: `${field.label}: ${summary}` }]
      : [];
  }),
);
</script>

<div class="flex min-w-0 flex-col gap-3" data-slot="workspace-task-filter-toolbar">
  <form {id} onsubmit={onapply} class="flex min-w-0 flex-wrap items-center gap-2" data-slot="table-filter-apply">
    <div class="w-full min-w-0 md:w-auto md:min-w-48 md:flex-1">
      <SearchField id={`${id}-search`} label={copy.taskFilters.search} placeholder={copy.taskFilters.search} value={draft.title ?? ""} oninput={(event) => onchange({title:event.currentTarget.value})} disabled={!ready} />
    </div>
    {#each common as field (field.name)}
      <Popover.Root>
        <Popover.Trigger>
          {#snippet child({props})}
            <Button {...props} type="button" variant="outline" class="h-11 min-w-11 md:h-8 md:min-w-11" disabled={!ready} data-filter-trigger={field.name}>
              {field.label}<ChevronDown data-icon="inline-end" />
            </Button>
          {/snippet}
        </Popover.Trigger>
        <Popover.Content aria-label={field.label} role="dialog" align="start" class="max-h-[70dvh] w-80 max-w-[calc(100vw-2rem)] overflow-y-auto">
          <TableFilterFields fields={[field]} values={draft} {onchange} labels={copy.tableFilters} idPrefix={`${id}-common`} formId={id} />
        </Popover.Content>
      </Popover.Root>
    {/each}
    <Popover.Root>
      <Popover.Trigger>
        {#snippet child({props})}
          <Button {...props} type="button" variant="outline" class="h-11 min-w-11 md:h-8 md:min-w-11" disabled={!ready} data-filter-trigger="more">
            <SlidersHorizontal data-icon="inline-start" />{copy.taskFilters.more}
          </Button>
        {/snippet}
      </Popover.Trigger>
      <Popover.Content aria-label={copy.taskFilters.more} role="dialog" align="end" class="max-h-[70dvh] w-80 max-w-[calc(100vw-2rem)] overflow-y-auto">
        <TableFilterFields fields={more} values={draft} {onchange} labels={copy.tableFilters} idPrefix={`${id}-more`} formId={id} />
      </Popover.Content>
    </Popover.Root>
    <div class="flex items-center gap-2" data-slot="workspace-task-filter-actions">
      <Button type="submit" class="h-11 min-w-11 md:h-8 md:min-w-11" disabled={!ready}>{copy.applyFilters}</Button>
      <Button type="button" variant="outline" class="h-11 min-w-11 md:h-8 md:min-w-11" disabled={!ready} onclick={onreset}>{copy.taskFilters.reset}</Button>
    </div>
  </form>
  {#if active.length}
    <div role="group" aria-label={copy.taskFilters.applied} class="flex min-w-0 flex-wrap items-center gap-2" data-slot="active-filters">
      <span class="text-sm text-muted-foreground">{copy.taskFilters.applied}</span>
      {#each active as condition (condition.name)}
        <Button type="button" variant="secondary" size="sm" class="h-auto min-h-11 min-w-11 max-w-full whitespace-normal text-left md:min-h-8 md:min-w-11" disabled={!ready} aria-label={`${copy.taskFilters.remove}: ${condition.label}`} onclick={() => onremove(condition.name)}>
          <span class="min-w-0 break-words">{condition.label}</span><X data-icon="inline-end" />
        </Button>
      {/each}
    </div>
  {/if}
  <p class="text-sm text-muted-foreground" data-slot="workspace-task-sort">{sortLabel}</p>
</div>
