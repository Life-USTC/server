<script lang="ts">
import ResponsiveCollection from "#lib/components/ResponsiveCollection.svelte";
import AdminBusVersionsMobileList from "@/features/admin/components/AdminBusVersionsMobileList.svelte";
import AdminBusVersionsTable from "@/features/admin/components/AdminBusVersionsTable.svelte";
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
</script>

<section class="grid min-w-0 gap-3">
  <ResponsiveCollection>
    {#snippet mobile()}
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
        {versions}
      />
    {/snippet}
  </ResponsiveCollection>
</section>
