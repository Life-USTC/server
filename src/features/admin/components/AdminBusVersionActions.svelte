<script lang="ts">
import CheckCircle from "@lucide/svelte/icons/check-circle";
import Trash2 from "@lucide/svelte/icons/trash-2";
import { enhance } from "$app/forms";
import { Button } from "$lib/components/ui/button/index.js";
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
  <form method="POST" action="?/activateVersion" use:enhance={enhancedAction(`activate-${version.id}`)}>
    <input type="hidden" name="id" value={version.id} />
    <Button size="sm" type="submit" disabled={Boolean(pendingAction)} variant="outline">
      {#if isPending(`activate-${version.id}`)}
        <Spinner data-icon="inline-start" />
      {:else}
        <CheckCircle data-icon="inline-start" />
      {/if}
      {copy.activateAction}
    </Button>
  </form>
  <Button
    variant="destructive"
    size="sm"
    type="button"
    disabled={Boolean(pendingAction)}
    onclick={() => onDelete(version)}
  >
    <Trash2 data-icon="inline-start" />
    {copy.deleteAction}
  </Button>
{/if}
