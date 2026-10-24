<script lang="ts">
import { onMount } from "svelte";
import TableColumnHeader from "#lib/components/TableColumnHeader.svelte";
import TableFilterFields from "#lib/components/TableFilterFields.svelte";
import type { TableFilterField, TableFilterLabels } from "@/lib/table-filters";

let {
  fields,
  values,
  applied,
  onchange,
  label,
  prefix,
  labels,
  formId,
}: {
  fields: TableFilterField[];
  values: Record<string, string>;
  applied: Record<string, string>;
  onchange: (patch: Record<string, string>) => void;
  label: string;
  prefix: string;
  labels: TableFilterLabels;
  formId: string;
} = $props();
let ready = $state(false);
onMount(() => {
  ready = true;
});
</script>

<TableColumnHeader {label} disabled={!ready} active={fields.some((field) => Boolean(applied[field.name]))}>
  <TableFilterFields {fields} {values} {onchange} {labels} idPrefix={prefix} {formId} />
</TableColumnHeader>
