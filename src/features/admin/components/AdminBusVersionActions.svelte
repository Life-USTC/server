<script lang="ts">
import CheckCircle from "@lucide/svelte/icons/check-circle";
import Trash2 from "@lucide/svelte/icons/trash-2";
import DashboardTableIconButton from "@/features/dashboard/components/DashboardTableIconButton.svelte";
import DashboardTableRowActions from "@/features/dashboard/components/DashboardTableRowActions.svelte";
import { enhance } from "$app/forms";
import { Spinner } from "$lib/components/ui/spinner/index.js";
import type {
  AdminBusCopy,
  AdminBusEnhancedAction,
  AdminBusVersion,
} from "./admin-bus-types";

export let copy: AdminBusCopy;
export let enhancedAction: AdminBusEnhancedAction;
export let isPending: (actionKey: string) => boolean;
export let onDelete: (version: AdminBusVersion) => void;
export let pendingAction: string | null;
export let version: AdminBusVersion;
</script>

{#if !version.isEnabled}
  <DashboardTableRowActions class="justify-end">
    <form
      method="POST"
      action="?/activateVersion"
      use:enhance={enhancedAction(`activate-${version.id}`)}
    >
      <input type="hidden" name="id" value={version.id} />
      <DashboardTableIconButton
        disabled={Boolean(pendingAction)}
        label={copy.activateAction}
        type="submit"
      >
        {#if isPending(`activate-${version.id}`)}
          <Spinner />
        {:else}
          <CheckCircle />
        {/if}
      </DashboardTableIconButton>
    </form>
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
