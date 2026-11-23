<script lang="ts">
import XIcon from "@lucide/svelte/icons/x";
import { createFilterDraft } from "@/lib/navigation/filter-draft.svelte";
import type { TableFilterField, TableFilterLabels } from "@/lib/table-filters";
import FacetFilter from "./FacetFilter.svelte";
import SearchField from "./SearchField.svelte";
import TableFieldFilter from "./TableFieldFilter.svelte";
import { Badge } from "./ui/badge/index.js";
import { Button } from "./ui/button/index.js";
import { Input } from "./ui/input/index.js";
import * as NativeSelect from "./ui/native-select/index.js";

let {
  action,
  filters,
  fields,
  searchLabel,
  placeholder,
  applyLabel,
  clearLabel,
  noResults,
  groupLabel,
  active,
  filterLabels,
  sort,
}: {
  action: string;
  filters: Record<string, string | null | undefined>;
  fields: TableFilterField[];
  searchLabel: string;
  placeholder: string;
  applyLabel: string;
  clearLabel: string;
  noResults: string;
  groupLabel: string;
  filterLabels: TableFilterLabels;
  sort?: {
    options: Record<string, string>;
    label: string;
    defaultLabel: string;
    asc: string;
    desc: string;
  };
  active: { label: string; href: string }[];
} = $props();
const draft = createFilterDraft(() => filters);
const id = $props.id();
</script>

<div class="grid gap-3" data-slot="table-filter-toolbar">
  <form
    id={id}
    method="get"
    {action}
    onsubmit={draft.submit}
    class="flex flex-wrap items-center gap-2"
  >
    <div class="flex w-full items-center gap-2">
      <SearchField
        id={id + "-search"}
        name="search"
        label={searchLabel}
        {placeholder}
        bind:value={
          () => draft.values.search ?? "",
          (value) => draft.update({ search: value })
        }
      />
      <Button type="submit">{applyLabel}</Button>
    </div>
    {#each fields as field (field.name)}
      {#if field.options}
        <FacetFilter
          label={field.label}
          options={field.options}
          value={draft.values[field.name]}
          {clearLabel}
          {noResults}
          onchange={(value) => draft.update({ [field.name]: value })}
        />
        {#if draft.values[field.name]}<input
            type="hidden"
            name={field.name}
            value={draft.values[field.name]}
          />{/if}
      {:else if field.type && field.type !== "text"}
        <TableFieldFilter label={field.label} fields={[field]} values={draft.values} onchange={draft.update} labels={filterLabels} idPrefix={id} formId={id} />
        {#each [field.name, field.name + "Op", field.name + "Max"] as name}
          {#if draft.values[name]}<input type="hidden" {name} value={draft.values[name]} />{/if}
        {/each}
      {:else}
        <Input
          class="w-36"
          name={field.name}
          placeholder={field.label}
          aria-label={field.label}
          bind:value={
            () => draft.values[field.name] ?? "",
            (value) => draft.update({ [field.name]: String(value ?? "") })
          }
        />
      {/if}
    {/each}
    {#if sort}
      <NativeSelect.Root name="sort" aria-label={sort.label} value={draft.values.sort ?? ""} onchange={e => draft.update({ sort: e.currentTarget.value })}>
        <NativeSelect.Option value="">{sort.defaultLabel}</NativeSelect.Option>
        {#each Object.entries(sort.options) as [value,label]}<NativeSelect.Option {value}>{label}</NativeSelect.Option>{/each}
      </NativeSelect.Root>
      {#if draft.values.sort}
        <NativeSelect.Root name="order" aria-label={sort.asc + " / " + sort.desc} value={draft.values.order || "asc"} onchange={e => draft.update({ order: e.currentTarget.value })}>
          <NativeSelect.Option value="asc">{sort.asc}</NativeSelect.Option><NativeSelect.Option value="desc">{sort.desc}</NativeSelect.Option>
        </NativeSelect.Root>
      {/if}
    {/if}
  </form>
  {#if active.length}
    <div
      class="flex flex-wrap items-center gap-2"
      role="group"
      aria-label={groupLabel}
      data-slot="active-filters"
    >
      {#each active as chip (chip.href)}
        <Badge
          href={chip.href}
          variant="secondary"
          class="max-w-full"
          aria-label={clearLabel + " · " + chip.label}
        >
          <span class="truncate">{chip.label}</span><XIcon
            data-icon="inline-end"
          />
        </Badge>
      {/each}
      <Button href={action} variant="ghost">{clearLabel}</Button>
    </div>
  {/if}
</div>
