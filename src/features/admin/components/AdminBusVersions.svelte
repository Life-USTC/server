<script lang="ts">
import ResponsiveCollection from "#lib/components/ResponsiveCollection.svelte";
import TableFieldFilter from "#lib/components/TableFieldFilter.svelte";
import { Button } from "#lib/components/ui/button/index.js";
import AdminBusVersionsMobileList from "@/features/admin/components/AdminBusVersionsMobileList.svelte";
import AdminBusVersionsTable from "@/features/admin/components/AdminBusVersionsTable.svelte";
import { getWorkspacePageCopy } from "@/lib/shell/page-copy";
import { matchTableFilter, type TableFilterField } from "@/lib/table-filters";
import { formatShanghaiDate } from "@/lib/time/shanghai-format";
import { page } from "$app/state";
import type {
  AdminBusCopy,
  AdminBusEnhancedAction,
  AdminBusVersion,
  AdminBusVersionFormatter,
} from "./admin-bus-types";

interface Props {
  copy: AdminBusCopy;
  enhancedAction: AdminBusEnhancedAction;
  formatEffectiveRange: AdminBusVersionFormatter;
  formatImportedAt: (value: string | Date) => string;
  isPending: (actionKey: string) => boolean;
  onDelete: (version: AdminBusVersion) => void;
  pendingAction: string | null;
  versions: AdminBusVersion[];
}

let {
  copy,
  enhancedAction,
  formatEffectiveRange,
  formatImportedAt,
  isPending,
  onDelete,
  pendingAction,
  versions,
}: Props = $props();
let draft = $state<Record<string, string>>({});
let applied = $state<Record<string, string>>({});
const common = $derived(
  getWorkspacePageCopy(page.data.locale === "en-us" ? "en-us" : "zh-cn").common,
);
const columns = $derived<TableFilterField[][]>([
  [
    { name: "title", label: copy.colTitle },
    { name: "sourceMessage", label: copy.filterSource },
  ],
  [{ name: "key", label: copy.colKey }],
  [
    {
      name: "tripCount",
      label: copy.colTrips,
      type: "number",
      min: 0,
      step: 1,
    },
  ],
  [
    { name: "effectiveFrom", label: copy.filterEffectiveFrom, type: "date" },
    { name: "effectiveUntil", label: copy.filterEffectiveUntil, type: "date" },
  ],
  [{ name: "importedAt", label: copy.colImported, type: "date" }],
  [
    {
      name: "isEnabled",
      label: copy.colStatus,
      options: [
        { value: "true", label: copy.statusActive },
        { value: "false", label: copy.statusInactive },
      ],
    },
  ],
]);
const visibleVersions = $derived(
  versions.filter((version) =>
    columns.flat().every((field) => {
      const value = version[field.name as keyof AdminBusVersion];
      return matchTableFilter(
        field.type === "date"
          ? value
            ? formatShanghaiDate(value as string | Date)
            : null
          : typeof value === "boolean"
            ? String(value)
            : (value as string | number | null),
        field,
        applied,
      );
    }),
  ),
);
function change(patch: Record<string, string>) {
  draft = { ...draft, ...patch };
}
function apply(event: SubmitEvent) {
  event.preventDefault();
  applied = { ...draft };
}
</script>

<section class="grid min-w-0 gap-3">
  <form id="admin-bus-filters" onsubmit={apply} class="flex flex-wrap items-center gap-3">
    <Button type="submit">{common.applyFilters}</Button>
  </form>
  <ResponsiveCollection>
    {#snippet mobile()}
      <div class="flex flex-wrap gap-3" data-slot="collection-header">{#each columns as fields, index}<TableFieldFilter label={index === 3 ? copy.colEffective : fields[0].label} {fields} values={draft} onchange={change} labels={common.tableFilters} idPrefix={`admin-bus-mobile-${index}`} formId="admin-bus-filters" />{/each}</div>
      <AdminBusVersionsMobileList
        {copy}
        {enhancedAction}
        {formatEffectiveRange}
        {formatImportedAt}
        {isPending}
        {onDelete}
        {pendingAction}
        versions={visibleVersions}
      />
    {/snippet}
    {#snippet desktop()}
      <AdminBusVersionsTable
        {copy}
        {enhancedAction}
        {formatEffectiveRange}
        {formatImportedAt}
        {isPending}
        {onDelete}
        {pendingAction}
        versions={visibleVersions}
        {columns}
        values={draft}
        onchange={change}
        filterLabels={common.tableFilters}
      />
    {/snippet}
  </ResponsiveCollection>
</section>
