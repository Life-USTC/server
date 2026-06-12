<script lang="ts">
import { enhance } from "$app/forms";
import CheckCircle from "$lib/components/icons/check-circle.svelte";
import RefreshCw from "$lib/components/icons/refresh-cw.svelte";
import Trash2 from "$lib/components/icons/trash-2.svelte";
import { Button } from "$lib/components/ui/button/index.js";
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
  <form method="POST" action="?/activateVersion" use:enhance={enhancedAction(`activate-${version.id}`)}>
    <input type="hidden" name="id" value={version.id} />
    <Button size="sm" type="submit" disabled={Boolean(pendingAction)} variant="outline">
      {#if isPending(`activate-${version.id}`)}
        <RefreshCw class="animate-spin" />
      {:else}
        <CheckCircle />
      {/if}
      {copy.activateAction}
    </Button>
  </form>
  <Button
    class="border-transparent bg-error text-error-content hover:bg-error/90"
    size="sm"
    type="button"
    disabled={Boolean(pendingAction)}
    onclick={() => onDelete(version)}
  >
    <Trash2 />
    {copy.deleteAction}
  </Button>
{/if}
