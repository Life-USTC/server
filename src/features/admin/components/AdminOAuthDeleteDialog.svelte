<script lang="ts">
import type { SubmitFunction } from "@sveltejs/kit";
import { enhance } from "$app/forms";
import TrashIcon from "$lib/components/icons/trash-2.svelte";
import { Button } from "$lib/components/ui/button/index.js";
import * as Dialog from "$lib/components/ui/dialog/index.js";
import type {
  AdminOAuthClient,
  AdminOAuthCopy,
} from "./admin-oauth-client-types";

export let client: Pick<AdminOAuthClient, "clientId" | "name"> | null;
export let close: () => void;
export let copy: AdminOAuthCopy;
export let deleteClientAction: SubmitFunction;
export let deletingClientId: string | null;
</script>

{#if client}
  <Dialog.Root
    open={true}
    class="max-w-md"
    aria-labelledby="oauth-delete-title"
    onOpenChange={(open) => {
      if (!open) close();
    }}
  >
    <Dialog.Header>
      <Dialog.Title id="oauth-delete-title">{copy.deleteClient}</Dialog.Title>
      <Dialog.Description>
        {copy.deleteClientDescription.replace("{name}", client.name ?? copy.unnamedClient)}
      </Dialog.Description>
    </Dialog.Header>
    <form
      method="POST"
      action="?/deleteClient"
      use:enhance={deleteClientAction}
    >
      <input type="hidden" name="clientId" value={client.clientId} />
      <div class="px-5 py-4">
        <p class="break-all font-mono text-base-content/60 text-xs">{client.clientId}</p>
      </div>
      <Dialog.Footer>
        <Button
          type="button"
          variant="outline"
          disabled={Boolean(deletingClientId)}
          onclick={close}
        >
          {copy.cancel}
        </Button>
        <Button
          class="border-transparent bg-error text-error-content hover:bg-error/90"
          disabled={Boolean(deletingClientId)}
          type="submit"
        >
          <TrashIcon />
          <span>{copy.deleteClient}</span>
        </Button>
      </Dialog.Footer>
    </form>
  </Dialog.Root>
{/if}
