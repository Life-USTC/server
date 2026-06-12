<script lang="ts">
import { enhance } from "$app/forms";
import RefreshCw from "$lib/components/icons/refresh-cw.svelte";
import Trash2 from "$lib/components/icons/trash-2.svelte";
import { Button } from "$lib/components/ui/button/index.js";
import * as Dialog from "$lib/components/ui/dialog/index.js";
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

<Dialog.Root
  open={true}
  class="max-w-lg"
  aria-labelledby="bus-delete-title"
  onOpenChange={(open) => {
    if (!open) close();
  }}
>
  <Dialog.Header>
    <Dialog.Title id="bus-delete-title">{copy.deleteTitle}</Dialog.Title>
    <Dialog.Description>
      {copy.deleteDescription.replace("{title}", version.title)}
    </Dialog.Description>
  </Dialog.Header>
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
    <Dialog.Footer>
      <Button
        type="button"
        disabled={Boolean(pendingAction)}
        variant="outline"
        onclick={close}
      >
        {copy.cancelAction}
      </Button>
      <Button
        class="border-transparent bg-error text-error-content hover:bg-error/90"
        disabled={Boolean(pendingAction)}
        type="submit"
      >
        {#if isPending(`delete-${version.id}`)}
          <RefreshCw class="animate-spin" />
        {:else}
          <Trash2 />
        {/if}
        {copy.confirmDeleteAction}
      </Button>
    </Dialog.Footer>
  </form>
</Dialog.Root>
