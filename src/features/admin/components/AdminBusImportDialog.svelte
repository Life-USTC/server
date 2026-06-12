<script lang="ts">
import { enhance } from "$app/forms";
import Download from "$lib/components/icons/download.svelte";
import RefreshCw from "$lib/components/icons/refresh-cw.svelte";
import { Alert } from "$lib/components/ui/alert/index.js";
import { Button } from "$lib/components/ui/button/index.js";
import * as Dialog from "$lib/components/ui/dialog/index.js";
import type { AdminBusCopy, AdminBusEnhancedAction } from "./admin-bus-types";

export let close: () => void;
export let copy: AdminBusCopy;
export let enhancedAction: AdminBusEnhancedAction;
export let isPending: (actionKey: string) => boolean;
export let pendingAction: string | null;
</script>

<Dialog.Root
  open={true}
  class="max-w-lg"
  aria-labelledby="bus-import-title"
  onOpenChange={(open) => {
    if (!open) close();
  }}
>
  <Dialog.Header>
    <Dialog.Title id="bus-import-title">{copy.importAction}</Dialog.Title>
    <Dialog.Description>
      {copy.importDescription}
    </Dialog.Description>
  </Dialog.Header>
  <form
    method="POST"
    action="?/importStatic"
    use:enhance={enhancedAction("import", close)}
  >
    <div class="px-5 py-4">
      <Alert variant="warning">
        {copy.importWarning}
      </Alert>
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
      <Button type="submit" disabled={Boolean(pendingAction)}>
        {#if isPending("import")}
          <RefreshCw class="animate-spin" />
        {:else}
          <Download />
        {/if}
        {copy.importAction}
      </Button>
    </Dialog.Footer>
  </form>
</Dialog.Root>
