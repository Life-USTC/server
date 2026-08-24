<script lang="ts">
import CheckCircle from "@lucide/svelte/icons/check-circle";
import Trash2 from "@lucide/svelte/icons/trash-2";
import DashboardTableIconButton from "@/features/dashboard/components/DashboardTableIconButton.svelte";
import DashboardTableRowActions from "@/features/dashboard/components/DashboardTableRowActions.svelte";
import { enhance } from "$app/forms";
import * as AlertDialog from "$lib/components/ui/alert-dialog/index.js";
import { Button } from "$lib/components/ui/button/index.js";
import { Spinner } from "$lib/components/ui/spinner/index.js";
import type {
  AdminBusCopy,
  AdminBusEnhancedAction,
  AdminBusVersion,
} from "./admin-bus-types";

export let copy: AdminBusCopy;
export let compact = false;
export let enhancedAction: AdminBusEnhancedAction;
export let isPending: (actionKey: string) => boolean;
export let onDelete: (version: AdminBusVersion) => void;
export let pendingAction: string | null;
export let version: AdminBusVersion;

let activateDialogOpen = false;
</script>

{#if !version.isEnabled}
  {#if compact}
    <div class="flex flex-wrap justify-end gap-2">
      <Button
        disabled={Boolean(pendingAction)}
        onclick={() => (activateDialogOpen = true)}
        size="sm"
        type="button"
        variant="outline"
      >
        {#if isPending(`activate-${version.id}`)}<Spinner data-icon="inline-start" />{:else}<CheckCircle data-icon="inline-start" />{/if}
        {copy.activateAction}
      </Button>
      <Button
        disabled={Boolean(pendingAction)}
        onclick={() => onDelete(version)}
        size="sm"
        type="button"
        variant="destructive"
      >
        <Trash2 data-icon="inline-start" />
        {copy.deleteAction}
      </Button>
    </div>
  {:else}
    <DashboardTableRowActions class="justify-end">
      <DashboardTableIconButton
        disabled={Boolean(pendingAction)}
        label={copy.activateAction}
        onclick={() => (activateDialogOpen = true)}
      >
        {#if isPending(`activate-${version.id}`)}<Spinner />{:else}<CheckCircle />{/if}
      </DashboardTableIconButton>
      <DashboardTableIconButton
        disabled={Boolean(pendingAction)}
        label={copy.deleteAction}
        variant="destructive"
        onclick={() => onDelete(version)}
      >
        <Trash2 />
      </DashboardTableIconButton>
    </DashboardTableRowActions>
  {/if}

  <AlertDialog.Root
    open={activateDialogOpen}
    onOpenChange={(open) => {
      if (!pendingAction) activateDialogOpen = open;
    }}
  >
    <AlertDialog.Content class="max-w-md sm:max-w-md">
      <AlertDialog.Header>
        <AlertDialog.Title>{copy.activateTitle}</AlertDialog.Title>
        <AlertDialog.Description>
          {copy.activateDescription.replace("{title}", version.title)}
        </AlertDialog.Description>
      </AlertDialog.Header>
      <div class="grid gap-1 px-5 py-4 text-sm">
        <div class="font-medium">{version.title}</div>
        <div class="break-all font-mono text-muted-foreground text-xs">
          {version.key}
        </div>
      </div>
      <form
        method="POST"
        action="?/activateVersion"
        use:enhance={enhancedAction(
          `activate-${version.id}`,
          () => (activateDialogOpen = false),
        )}
      >
        <input type="hidden" name="id" value={version.id} />
        <AlertDialog.Footer>
          <AlertDialog.Cancel
            type="button"
            disabled={Boolean(pendingAction)}
            variant="outline"
          >
            {copy.cancelAction}
          </AlertDialog.Cancel>
          <Button type="submit" disabled={Boolean(pendingAction)}>
            {#if isPending(`activate-${version.id}`)}
              <Spinner data-icon="inline-start" />
            {:else}
              <CheckCircle data-icon="inline-start" />
            {/if}
            {copy.confirmActivateAction}
          </Button>
        </AlertDialog.Footer>
      </form>
    </AlertDialog.Content>
  </AlertDialog.Root>
{/if}
