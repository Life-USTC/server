<script lang="ts">
import TableColumnHeader from "#lib/components/TableColumnHeader.svelte";
import { Button } from "#lib/components/ui/button/index.js";
import * as Field from "#lib/components/ui/field/index.js";
import { Input } from "#lib/components/ui/input/index.js";
import * as NativeSelect from "#lib/components/ui/native-select/index.js";
import { catalogHref } from "@/features/catalog/lib/catalog-list-display";
import type { CatalogColumnFilterProps } from "./catalog-column-filter-types";

let {
  action,
  label,
  fields = [],
  filters,
  search,
  applyLabel,
  clearLabel,
  align = "start",
  sorting,
  idPrefix,
}: CatalogColumnFilterProps & { idPrefix: string } = $props();

let open = $state(false);
let draft = $state<Record<string, string>>({});
const fieldNames = $derived(fields.map((field) => field.name));
const sort = $derived(
  sorting && filters.sort === sorting.key
    ? filters.order === "desc"
      ? "desc"
      : "asc"
    : null,
);
const active = $derived(fields.some((field) => Boolean(filters[field.name])));
const hidden = $derived(
  Object.entries({ ...filters, search }).filter(
    ([name, value]) =>
      name !== "page" && !fieldNames.includes(name) && Boolean(value),
  ),
);

$effect(() => {
  if (open) {
    draft = Object.fromEntries(
      fields.map((field) => [field.name, filters[field.name] ?? ""]),
    );
  }
});

function clearHref() {
  return catalogHref(action, {
    ...filters,
    ...Object.fromEntries(fieldNames.map((name) => [name, ""])),
    search,
  });
}

function sortHref(order: "asc" | "desc" | null) {
  return catalogHref(action, {
    ...filters,
    search,
    sort: order ? sorting?.key : null,
    order,
  });
}
</script>

<TableColumnHeader {label} {active} {align} {sort} bind:open>
  <div class="grid gap-4">
    {#if fields.length}
      <form method="get" {action}>
        {#each hidden as [name, value]}
          <input type="hidden" {name} value={value ?? ""} />
        {/each}
        <Field.Group class="gap-3">
          {#each fields as field (field.name)}
            <Field.Field>
              <Field.Label for={`${idPrefix}-${field.name}`}>{field.label}</Field.Label>
              {#if field.options}
                <NativeSelect.Root id={`${idPrefix}-${field.name}`} name={field.name} bind:value={draft[field.name]} class="w-full">
                  {#each field.options as option (option.value)}
                    <NativeSelect.Option value={option.value}>{option.label}</NativeSelect.Option>
                  {/each}
                </NativeSelect.Root>
              {:else}
                <Input id={`${idPrefix}-${field.name}`} name={field.name} type={field.type ?? "text"} min={field.min} step={field.step} bind:value={draft[field.name]} />
              {/if}
              {#if field.description}<Field.Description>{field.description}</Field.Description>{/if}
            </Field.Field>
          {/each}
          <div class="flex flex-wrap gap-2">
            <Button type="submit" size="sm">{applyLabel}</Button>
            <Button href={clearHref()} variant="outline" size="sm">{clearLabel}</Button>
          </div>
        </Field.Group>
      </form>
    {/if}
    {#if sorting}
      <Field.Set class="gap-2">
        <Field.Legend>{sorting.label}</Field.Legend>
        <div class="flex flex-wrap gap-2">
          <Button href={sortHref("asc")} variant={sort === "asc" ? "secondary" : "outline"} size="sm">{sorting.ascending}</Button>
          <Button href={sortHref("desc")} variant={sort === "desc" ? "secondary" : "outline"} size="sm">{sorting.descending}</Button>
          {#if sort}<Button href={sortHref(null)} variant="ghost" size="sm">{sorting.default}</Button>{/if}
        </div>
      </Field.Set>
    {/if}
  </div>
</TableColumnHeader>
