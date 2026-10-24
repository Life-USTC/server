<script lang="ts">
import type { TableFilterField, TableFilterLabels } from "@/lib/table-filters";
import TableColumnHeader from "./TableColumnHeader.svelte";

let {
  label,
  fields,
  values,
  onchange,
  labels,
  idPrefix,
  formId,
}: {
  label: string;
  fields: TableFilterField[];
  values: Record<string, string>;
  onchange: (patch: Record<string, string>) => void;
  labels: TableFilterLabels;
  idPrefix: string;
  formId?: string;
} = $props();
let open = $state(false);
</script>

<TableColumnHeader {label} bind:open active={fields.some((field) => Boolean(values[field.name]))}>
  {#if open}
    {#await import("./TableFilterFields.svelte") then fieldModule}
      {@const FilterFields = fieldModule.default}
      <FilterFields {fields} {values} {onchange} {labels} {idPrefix} {formId} />
    {/await}
  {/if}
</TableColumnHeader>
