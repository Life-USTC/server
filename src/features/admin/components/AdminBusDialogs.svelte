<script lang="ts">
import AdminBusDeleteDialog from "@/features/admin/components/AdminBusDeleteDialog.svelte";
import AdminBusImportDialog from "@/features/admin/components/AdminBusImportDialog.svelte";
import type {
  AdminBusCopy,
  AdminBusEnhancedAction,
  AdminBusVersion,
} from "./admin-bus-types";

export let closeDeleteDialog: () => void;
export let closeImportDialog: () => void;
export let copy: AdminBusCopy;
export let enhancedAction: AdminBusEnhancedAction;
export let isImportDialogOpen: boolean;
export let isPending: (actionKey: string) => boolean;
export let pendingAction: string | null;
export let pendingDeleteVersion: AdminBusVersion | null;
</script>

{#if isImportDialogOpen}
  <AdminBusImportDialog
    close={closeImportDialog}
    {copy}
    {enhancedAction}
    {isPending}
    {pendingAction}
  />
{/if}

{#if pendingDeleteVersion}
  <AdminBusDeleteDialog
    close={closeDeleteDialog}
    {copy}
    {enhancedAction}
    {isPending}
    {pendingAction}
    version={pendingDeleteVersion}
  />
{/if}
