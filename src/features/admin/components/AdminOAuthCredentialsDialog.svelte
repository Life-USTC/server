<script lang="ts">
import CopyIcon from "$lib/components/icons/copy.svelte";
import { Button } from "$lib/components/ui/button/index.js";
import * as Dialog from "$lib/components/ui/dialog/index.js";
import AdminOAuthCredentialField from "./AdminOAuthCredentialField.svelte";
import AdminOAuthCredentialMetadata from "./AdminOAuthCredentialMetadata.svelte";
import type { AdminOAuthCopy } from "./admin-oauth-client-types";

export let clientId: string | null | undefined;
export let clientSecret: string | null | undefined;
export let clientTypeLabel: (method: string) => string;
export let close: () => void;
export let copy: AdminOAuthCopy;
export let copyText: (value: string, message: string) => void;
export let credentialsJson: string;
export let redirectUris: string[];
export let scopes: string[];
export let scopeLabel: (scope: string) => string;
export let tokenEndpointAuthMethod: string | null | undefined;
export let trusted: boolean | null | undefined;
export let open: boolean;
</script>

{#if open}
  <Dialog.Root
    open={true}
    class="max-w-2xl"
    aria-labelledby="oauth-credentials-title"
    onOpenChange={(nextOpen) => {
      if (!nextOpen) close();
    }}
  >
    <Dialog.Header>
      <Dialog.Title id="oauth-credentials-title">{copy.credentialsTitle}</Dialog.Title>
      <Dialog.Description>{copy.credentialsWarning}</Dialog.Description>
    </Dialog.Header>
    {#if clientId}
      <div class="grid gap-3 px-5 py-4">
        <AdminOAuthCredentialField
          copiedMessage={copy.clientIdCopied}
          copyLabel={copy.copyClientId}
          {copyText}
          label={copy.clientIdLabel}
          value={clientId}
        />
        <AdminOAuthCredentialField
          copiedMessage={copy.clientSecretCopied}
          copyLabel={copy.copyClientSecret}
          {copyText}
          label={copy.clientSecretLabel}
          showCopy={Boolean(clientSecret)}
          value={clientSecret ?? copy.publicClientNoSecret}
        />
        <AdminOAuthCredentialMetadata
          {clientTypeLabel}
          {copy}
          {redirectUris}
          {scopes}
          {scopeLabel}
          {tokenEndpointAuthMethod}
          {trusted}
        />
        <div>
          <Button
            size="sm"
            type="button"
            variant="outline"
            onclick={() => copyText(credentialsJson, copy.credentialsCopied)}
          >
            <CopyIcon />
            <span>{copy.copyCredentials}</span>
          </Button>
        </div>
      </div>
    {/if}
    <Dialog.Footer>
      <Button type="button" onclick={close}>{copy.dismissCredentials}</Button>
    </Dialog.Footer>
  </Dialog.Root>
{/if}
