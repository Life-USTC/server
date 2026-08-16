<script lang="ts">
import CopyIcon from "@lucide/svelte/icons/copy";
import * as Alert from "$lib/components/ui/alert/index.js";
import { Button } from "$lib/components/ui/button/index.js";
import { Checkbox } from "$lib/components/ui/checkbox/index.js";
import * as Dialog from "$lib/components/ui/dialog/index.js";
import AdminOAuthCredentialField from "./AdminOAuthCredentialField.svelte";
import AdminOAuthCredentialMetadata from "./AdminOAuthCredentialMetadata.svelte";
import type { AdminOAuthCopy } from "./admin-oauth-client-types";

export let clientId: string | null | undefined;
export let clientSecret: string | null | undefined;
export let clientTypeLabel: (method: string) => string;
export let close: () => void;
export let copy: AdminOAuthCopy;
export let copyMessage: string;
export let copyMessageVariant: "destructive" | "default";
export let copyText: (value: string, message: string) => Promise<boolean>;
export let credentialsJson: string;
export let redirectUris: string[];
export let scopes: string[];
export let scopeLabel: (scope: string) => string;
export let tokenEndpointAuthMethod: string | null | undefined;
export let trusted: boolean | null | undefined;
export let open: boolean;

let hasAcknowledgedSavedSecret = false;
let credentialsClientId = clientId;
let preventedDismissalCount = 0;

$: requiresSecretCopy = Boolean(clientSecret);
$: canDismissCredentials = !clientSecret || hasAcknowledgedSavedSecret;
$: if (clientId !== credentialsClientId) {
  credentialsClientId = clientId;
  hasAcknowledgedSavedSecret = false;
  preventedDismissalCount = 0;
}

async function copyCredential(
  value: string,
  message: string,
  includesSecret: boolean,
) {
  const copied = await copyText(value, message);
  if (copied && includesSecret) hasAcknowledgedSavedSecret = true;
}
</script>

{#if open}
  {#key `${clientId ?? "public"}:${preventedDismissalCount}`}
    <Dialog.Root
      open={true}
      onOpenChange={(nextOpen) => {
        if (nextOpen) return;
        if (canDismissCredentials) close();
        else preventedDismissalCount += 1;
      }}
    >
    <Dialog.Content
      class="max-w-2xl sm:max-w-2xl"
      aria-labelledby="oauth-credentials-title"
      escapeKeydownBehavior={canDismissCredentials ? "close" : "ignore"}
      interactOutsideBehavior={canDismissCredentials ? "close" : "ignore"}
      showCloseButton={canDismissCredentials}
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
            copyText={(value, message) => copyCredential(value, message, false)}
            label={copy.clientIdLabel}
            value={clientId}
          />
          <AdminOAuthCredentialField
            copiedMessage={copy.clientSecretCopied}
            copyLabel={copy.copyClientSecret}
            copyText={(value, message) => copyCredential(value, message, true)}
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
              type="button"
              variant="outline"
              onclick={() =>
                copyCredential(
                  credentialsJson,
                  copy.credentialsCopied,
                  Boolean(clientSecret),
                )}
            >
              <CopyIcon data-icon="inline-start" />
              <span>{copy.copyCredentials}</span>
            </Button>
          </div>
          {#if copyMessage}
            <Alert.Root variant={copyMessageVariant}>
              <Alert.Description>{copyMessage}</Alert.Description>
            </Alert.Root>
          {/if}
          {#if requiresSecretCopy}
            <label class="flex items-start gap-3 text-sm" for="oauth-credentials-saved">
              <Checkbox
                id="oauth-credentials-saved"
                bind:checked={hasAcknowledgedSavedSecret}
              />
              <span>{copy.credentialsSavedAcknowledgement}</span>
            </label>
          {/if}
          {#if requiresSecretCopy && !hasAcknowledgedSavedSecret}
            <p class="text-sm text-muted-foreground">
              {copy.credentialsCopyRequired}
            </p>
          {/if}
        </div>
      {/if}
      <Dialog.Footer>
        <Button
          type="button"
          disabled={!canDismissCredentials}
          onclick={close}
        >
          {copy.dismissCredentials}
        </Button>
      </Dialog.Footer>
    </Dialog.Content>
    </Dialog.Root>
  {/key}
{/if}
