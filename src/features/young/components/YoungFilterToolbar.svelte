<script lang="ts">
import SearchField from "#lib/components/SearchField.svelte";
import { Badge } from "#lib/components/ui/badge/index.js";
import { Button } from "#lib/components/ui/button/index.js";
import type { AppPageCopy } from "@/lib/shell/page-copy";
import { type TableFilterField, tableFilterValues } from "@/lib/table-filters";
import YoungEventFilters from "./YoungEventFilters.svelte";

let {
  copy,
  id,
  action,
  placeholder,
  applied,
  fieldsFor,
}: {
  copy: AppPageCopy;
  id: string;
  action: string;
  placeholder: string;
  applied: Record<string, string>;
  fieldsFor: (values: Record<string, string>) => TableFilterField[];
} = $props();

let draft = $derived({ ...applied });
const fields = $derived(
  fieldsFor(draft).filter((field) => field.name !== "search"),
);
const active = $derived(
  fieldsFor(applied).filter((field) => applied[field.name]),
);

function update(patch: Record<string, string>) {
  draft = { ...draft, ...patch };
}

function summary(field: TableFilterField) {
  const value = applied[field.name];
  if (!field.options) return value;
  return tableFilterValues(value)
    .map(
      (key) =>
        field.options?.find((option) => option.value === key)?.label ?? key,
    )
    .join(", ");
}
</script>

<div class="grid gap-3" data-slot="table-filter-toolbar">
  <form {id} {action} method="get" class="flex flex-wrap items-center gap-2" data-slot="table-filter-apply">
    {#each Object.entries(draft).filter(([name, value]) => name !== "search" && value) as [name, value]}
      {#if name === "category"}
        {#each tableFilterValues(value) as category}
          <input type="hidden" {name} value={decodeURIComponent(category)} />
        {/each}
      {:else}
        <input type="hidden" {name} {value} />
      {/if}
    {/each}
    <SearchField name="search" id={id + "-search"} label={copy.common.search} {placeholder}
      bind:value={() => draft.search ?? "", value => update({search: value})} />
    <Button type="submit">{copy.common.applyFilters}</Button>
    <Button type="button" variant="ghost" onclick={() => { draft = {}; }}>{copy.common.clear}</Button>
  </form>
  <div class="flex flex-wrap gap-2" data-slot="collection-header">
    {#each fields as field (field.name)}
      <YoungEventFilters {copy} fields={[field]} values={draft} {applied} onchange={update}
        label={field.label} prefix={id + "-" + field.name} formId={id} />
    {/each}
  </div>
  {#if active.length}
    <div class="flex flex-wrap gap-2" role="group" aria-label={copy.youngEvents.activeFilters}>
      {#each active as field (field.name)}
        <Badge variant="outline" class="h-auto max-w-full whitespace-normal wrap-anywhere">{field.label}: {summary(field)}</Badge>
      {/each}
    </div>
  {/if}
</div>
