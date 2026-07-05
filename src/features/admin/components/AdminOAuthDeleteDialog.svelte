<script lang="ts">
import type { SubmitFunction } from "@sveltejs/kit";
import { enhance } from "$app/forms";
import TrashIcon from "$lib/components/icons/trash-2.svelte";
import * as AlertDialog from "$lib/components/ui/alert-dialog/index.js";
import { Button } from "$lib/components/ui/button/index.js";
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
  <AlertDialog.Root
    open={true}
    onOpenChange={(open) => {
      if (!open) close();
    }}
  >
    <AlertDialog.Content
      class="max-w-md"
      aria-labelledby="oauth-delete-title"
    >
      <AlertDialog.Header>
        <AlertDialog.Title id="oauth-delete-title">{copy.deleteClient}</AlertDialog.Title>
        <AlertDialog.Description>
          {copy.deleteClientDescription.replace("{name}", client.name ?? copy.unnamedClient)}
        </AlertDialog.Description>
      </AlertDialog.Header>
      <form
        method="POST"
        action="?/deleteClient"
        use:enhance={deleteClientAction}
      >
        <input type="hidden" name="clientId" value={client.clientId} />
        <div class="px-5 py-4">
          <p class="break-all font-mono text-base-content/60 text-xs">{client.clientId}</p>
        </div>
        <AlertDialog.Footer>
          <AlertDialog.Cancel
            type="button"
            variant="outline"
            disabled={Boolean(deletingClientId)}
          >
            {copy.cancel}
          </AlertDialog.Cancel>
          <Button
            disabled={Boolean(deletingClientId)}
            type="submit"
            variant="destructive"
          >
            <TrashIcon data-icon="inline-start" />
            <span>{copy.deleteClient}</span>
          </Button>
        </AlertDialog.Footer>
      </form>
    </AlertDialog.Content>
  </AlertDialog.Root>
{/if}
