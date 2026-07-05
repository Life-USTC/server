<script lang="ts">
import Trash2 from "@lucide/svelte/icons/trash-2";
import { enhance } from "$app/forms";
import * as AlertDialog from "$lib/components/ui/alert-dialog/index.js";
import { Button } from "$lib/components/ui/button/index.js";
import { Spinner } from "$lib/components/ui/spinner/index.js";
import type {
  AdminBusCopy,
  AdminBusEnhancedAction,
  AdminBusVersion,
} from "./admin-bus-types";

export let close: () => void;
export let copy: AdminBusCopy;
export let enhancedAction: AdminBusEnhancedAction;
export let isPending: (actionKey: string) => boolean;
export let pendingAction: string | null;
export let version: AdminBusVersion;
</script>

<AlertDialog.Root
  open={true}
  onOpenChange={(open) => {
    if (!open) close();
  }}
>
  <AlertDialog.Content
    class="max-w-lg sm:max-w-lg"
    aria-labelledby="bus-delete-title"
  >
    <AlertDialog.Header>
      <AlertDialog.Title id="bus-delete-title">{copy.deleteTitle}</AlertDialog.Title>
      <AlertDialog.Description>
        {copy.deleteDescription.replace("{title}", version.title)}
      </AlertDialog.Description>
    </AlertDialog.Header>
    <form
      method="POST"
      action="?/deleteVersion"
      use:enhance={enhancedAction(`delete-${version.id}`, close)}
    >
      <input type="hidden" name="id" value={version.id} />
      <div class="grid gap-2 px-5 py-4 text-sm">
        <div class="font-medium">{version.title}</div>
        <div class="break-all font-mono text-base-content/60 text-xs">
          {version.key}
        </div>
      </div>
      <AlertDialog.Footer>
        <AlertDialog.Cancel
          type="button"
          disabled={Boolean(pendingAction)}
          variant="outline"
        >
          {copy.cancelAction}
        </AlertDialog.Cancel>
        <Button
          disabled={Boolean(pendingAction)}
          type="submit"
          variant="destructive"
        >
          {#if isPending(`delete-${version.id}`)}
            <Spinner data-icon="inline-start" />
          {:else}
            <Trash2 data-icon="inline-start" />
          {/if}
          {copy.confirmDeleteAction}
        </Button>
      </AlertDialog.Footer>
    </form>
  </AlertDialog.Content>
</AlertDialog.Root>
