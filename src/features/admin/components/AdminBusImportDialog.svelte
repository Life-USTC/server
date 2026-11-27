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
    <Dialog.Header heading={copy.importAction} titleId="bus-import-title" description={copy.importDescription} />
    <form
      method="POST"
      action="?/importStatic"
      use:enhance={enhancedAction("import", close)}
    >
      <div class="px-5 py-4">
        <Alert.Message>{copy.importWarning}</Alert.Message>
      </div>
      <Dialog.Actions cancelLabel={copy.cancelAction} onCancel={close} cancelDisabled={Boolean(pendingAction)}>
        <Button loading={pendingAction === "import"} icon={Download} type="submit" disabled={Boolean(pendingAction)}>
          {copy.importAction}
        </Button>
      </Dialog.Actions>
    </form>
  </Dialog.Content>
</Dialog.Root>
