<script lang="ts">
import Download from "@lucide/svelte/icons/download";
import * as Alert from "#lib/components/ui/alert/index.js";
import { Button } from "#lib/components/ui/button/index.js";
import * as Dialog from "#lib/components/ui/dialog/index.js";
import { enhance } from "$app/forms";
import type { AdminBusCopy, AdminBusEnhancedAction } from "./admin-bus-types";

interface Props {
  close: () => void;
  copy: AdminBusCopy;
  enhancedAction: AdminBusEnhancedAction;
  pendingAction: string | null;
}

let { close, copy, enhancedAction, pendingAction }: Props = $props();
</script>

<Dialog.Root
  open={true}
  onOpenChange={(open) => {
    if (!open) close();
  }}
>
  <Dialog.Content
    class="max-w-lg sm:max-w-lg"
    aria-labelledby="bus-import-title"
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
        <Alert.Message>{copy.importWarning}</Alert.Message>
      </div>
      <div data-slot="dialog-footer">
        <Button
          disabled={Boolean(pendingAction)}
          variant="outline"
          onclick={close}
        >
          {copy.cancelAction}
        </Button>
        <Button loading={pendingAction === "import"} icon={Download} type="submit" disabled={Boolean(pendingAction)}>
          {copy.importAction}
        </Button>
      </div>
    </form>
  </Dialog.Content>
</Dialog.Root>
