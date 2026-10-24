<script lang="ts">
import TableColumnHeader from "#lib/components/TableColumnHeader.svelte";
import TableFilterFields from "#lib/components/TableFilterFields.svelte";
import type { AppPageCopy } from "@/lib/shell/page-copy";
import type { TableFilterField } from "@/lib/table-filters";

let {
  copy,
  fields,
  values,
  applied,
  onchange,
  prefix,
  label,
  formId,
}: {
  copy: AppPageCopy;
  fields: TableFilterField[];
  values: Record<string, string>;
  applied: Record<string, string>;
  onchange: (patch: Record<string, string>) => void;
  prefix: string;
  label: string;
  formId: string;
} = $props();
</script>

<TableColumnHeader {label} align={fields.every((field) => field.type === "number") ? "end" : "start"} active={fields.some((field) => Boolean(applied[field.name]))}>
  <TableFilterFields {fields} {values} {onchange} labels={copy.common.tableFilters} idPrefix={prefix} {formId} />
</TableColumnHeader>
