<script lang="ts">
import SearchField from "#lib/components/SearchField.svelte";
import TableFieldFilter from "#lib/components/TableFieldFilter.svelte";
import type { TableFilterField, TableFilterLabels } from "@/lib/table-filters";
import type { AdminModerationFilterKind } from "./admin-moderation-page-types";

export let fields: TableFilterField[];
export let filters: Record<string, string>;
export let onchange: (patch: Record<string, string>) => void;
export let labels: TableFilterLabels;
export let searchPlaceholder: string;
export let kind: AdminModerationFilterKind;
export let viewport: "mobile" | "desktop";
$: id = `admin-moderation-${viewport}-${kind}`;
</script>

{#if kind === "search"}
  <div class="w-full min-w-0">
    <SearchField {id} form="moderation-filters" label={searchPlaceholder} placeholder={searchPlaceholder} value={filters.search ?? ""} oninput={(event) => onchange({ search: event.currentTarget.value })} />
  </div>
{:else}
  <TableFieldFilter label={fields[0].label} {fields} values={filters} {onchange} {labels} idPrefix={id} formId="moderation-filters" />
{/if}
