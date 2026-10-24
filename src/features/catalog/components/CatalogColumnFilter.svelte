<script lang="ts">
import TableColumnHeader from "#lib/components/TableColumnHeader.svelte";
import TableFilterFields from "#lib/components/TableFilterFields.svelte";
import * as Field from "#lib/components/ui/field/index.js";
import * as ToggleGroup from "#lib/components/ui/toggle-group/index.js";
import type { CatalogColumnFilterProps } from "./catalog-column-filter-types";

let {
  label,
  fields = [],
  values,
  onchange,
  labels,
  formId,
  align = "start",
  sorting,
  idPrefix,
}: CatalogColumnFilterProps & { idPrefix: string } = $props();
const sort = $derived(
  sorting && values.sort === sorting.key
    ? values.order === "desc"
      ? "desc"
      : "asc"
    : null,
);
const active = $derived(fields.some((field) => Boolean(values[field.name])));
</script>

<TableColumnHeader {label} {active} {align} {sort}>
  <div class="grid gap-4">
    <TableFilterFields {fields} {values} {onchange} {labels} {idPrefix} {formId} />
    {#if sorting}
      <Field.Set class="gap-2">
        <Field.Legend>{sorting.label}</Field.Legend>
        <ToggleGroup.Root type="single" variant="outline" aria-label={sorting.label} value={sort ?? "default"} onValueChange={(value) => { if (value) onchange({ sort: value === "default" ? "" : sorting?.key ?? "", order: value === "default" ? "" : value }); }}>
          <ToggleGroup.Item value="asc">{sorting.ascending}</ToggleGroup.Item>
          <ToggleGroup.Item value="desc">{sorting.descending}</ToggleGroup.Item>
          <ToggleGroup.Item value="default">{sorting.default}</ToggleGroup.Item>
        </ToggleGroup.Root>
      </Field.Set>
    {/if}
  </div>
</TableColumnHeader>
