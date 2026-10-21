<script lang="ts">
import AdminBusDeleteDialog from "@/features/admin/components/AdminBusDeleteDialog.svelte";
import AdminBusImportDialog from "@/features/admin/components/AdminBusImportDialog.svelte";
import type {
  AdminBusCopy,
  AdminBusEnhancedAction,
  AdminBusVersion,
} from "./admin-bus-types";

interface Props {
  closeDeleteDialog: () => void;
  closeImportDialog: () => void;
  copy: AdminBusCopy;
  enhancedAction: AdminBusEnhancedAction;
  isImportDialogOpen: boolean;
  isPending: (actionKey: string) => boolean;
  pendingAction: string | null;
  pendingDeleteVersion: AdminBusVersion | null;
}

let {
  closeDeleteDialog,
  closeImportDialog,
  copy,
  enhancedAction,
  isImportDialogOpen,
  isPending,
  pendingAction,
  pendingDeleteVersion,
}: Props = $props();
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
