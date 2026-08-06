<script lang="ts">
import AdminBusVersionsMobileList from "@/features/admin/components/AdminBusVersionsMobileList.svelte";
import AdminBusVersionsTable from "@/features/admin/components/AdminBusVersionsTable.svelte";
import type {
  AdminBusCopy,
  AdminBusEnhancedAction,
  AdminBusVersion,
  AdminBusVersionFormatter,
} from "./admin-bus-types";

export let copy: AdminBusCopy;
export let enhancedAction: AdminBusEnhancedAction;
export let formatEffectiveRange: AdminBusVersionFormatter;
export let formatImportedAt: (value: string | Date) => string;
export let isPending: (actionKey: string) => boolean;
export let onDelete: (version: AdminBusVersion) => void;
export let pendingAction: string | null;
export let versions: AdminBusVersion[];
</script>

<section class="grid min-w-0 gap-3">
  <AdminBusVersionsMobileList
    {copy}
    {enhancedAction}
    {formatEffectiveRange}
    {formatImportedAt}
    {isPending}
    {onDelete}
    {pendingAction}
    {versions}
  />

  <AdminBusVersionsTable
    {copy}
    {enhancedAction}
    {formatEffectiveRange}
    {formatImportedAt}
    {isPending}
    {onDelete}
    {pendingAction}
    {versions}
  />
</section>
