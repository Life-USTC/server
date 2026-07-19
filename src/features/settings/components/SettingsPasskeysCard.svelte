<script lang="ts">
import Fingerprint from "@lucide/svelte/icons/fingerprint";
import { onMount } from "svelte";
import {
  isPasskeySupported,
  passkeyAuthClient,
  passkeyClientErrorKind,
} from "$lib/auth/passkey-client";
import * as Alert from "$lib/components/ui/alert/index.js";
import { Button } from "$lib/components/ui/button/index.js";
import * as Card from "$lib/components/ui/card/index.js";
import * as Empty from "$lib/components/ui/empty/index.js";
import * as Field from "$lib/components/ui/field/index.js";
import * as InputGroup from "$lib/components/ui/input-group/index.js";
import * as Item from "$lib/components/ui/item/index.js";
import { Skeleton } from "$lib/components/ui/skeleton/index.js";
import { Spinner } from "$lib/components/ui/spinner/index.js";
import SettingsPasskeyRow from "./SettingsPasskeyRow.svelte";
import type { SettingsCopy } from "./settings-component-types";

type Status = {
  kind: "error" | "success";
  message: string;
};

export let copy: SettingsCopy;

const getPasskeysStore = passkeyAuthClient.useListPasskeys;
const passkeyQuery = getPasskeysStore();
let adding = false;
let name = "";
let status: Status | null = null;
let supported: boolean | null = null;

$: passkeys = $passkeyQuery.data ?? [];

onMount(() => {
  supported = isPasskeySupported();
});

function errorMessage(error: unknown) {
  const kind = passkeyClientErrorKind(error);
  if (kind === "stale-session") return copy.settings.passkeys.staleSession;
  if (kind === "duplicate") return copy.settings.passkeys.duplicate;
  if (kind === "cancelled") return copy.settings.passkeys.cancelled;
  return copy.settings.passkeys.genericError;
}

async function addPasskey() {
  const passkeyName = name.trim();
  if (!passkeyName || adding || supported !== true) return;

  status = null;
  adding = true;
  try {
    const result = await passkeyAuthClient.passkey.addPasskey({
      name: passkeyName,
    });
    if (result.error) {
      status = { kind: "error", message: errorMessage(result.error) };
      return;
    }
    name = "";
    status = {
      kind: "success",
      message: copy.settings.passkeys.added,
    };
    await $passkeyQuery.refetch();
  } catch {
    status = {
      kind: "error",
      message: copy.settings.passkeys.genericError,
    };
  } finally {
    adding = false;
  }
}
</script>

<Card.Root data-passkey-settings>
  <Card.Header>
    <Card.Title>{copy.settings.passkeys.title}</Card.Title>
    <Card.Description>{copy.settings.passkeys.description}</Card.Description>
  </Card.Header>
  <Card.Content class="flex flex-col gap-4">
    {#if supported === false}
      <Alert.Root>
        <Fingerprint />
        <Alert.Title>{copy.settings.passkeys.unsupportedTitle}</Alert.Title>
        <Alert.Description>
          {copy.settings.passkeys.unsupportedDescription}
        </Alert.Description>
      </Alert.Root>
    {/if}

    {#if status}
      <Alert.Root variant={status.kind === "error" ? "destructive" : "default"}>
        <Alert.Description>{status.message}</Alert.Description>
      </Alert.Root>
    {/if}

    <form
      onsubmit={(event) => {
        event.preventDefault();
        void addPasskey();
      }}
    >
      <Field.FieldGroup>
        <Field.Field data-disabled={supported !== true}>
          <Field.FieldLabel for="new-passkey-name">
            {copy.settings.passkeys.name}
          </Field.FieldLabel>
          <InputGroup.Root>
            <InputGroup.Input
              autocomplete="off"
              disabled={supported !== true || adding}
              id="new-passkey-name"
              maxlength={64}
              placeholder={copy.settings.passkeys.namePlaceholder}
              bind:value={name}
            />
            <InputGroup.Addon align="inline-end">
              <InputGroup.Button
                disabled={supported !== true || adding || !name.trim()}
                type="submit"
              >
                {#if adding}
                  <Spinner data-icon="inline-start" />
                  {copy.settings.passkeys.adding}
                {:else}
                  {copy.settings.passkeys.add}
                {/if}
              </InputGroup.Button>
            </InputGroup.Addon>
          </InputGroup.Root>
        </Field.Field>
      </Field.FieldGroup>
    </form>

    {#if $passkeyQuery.isPending}
      <div class="flex flex-col gap-2" aria-label={copy.settings.passkeys.title}>
        <Skeleton class="h-12 w-full" />
        <Skeleton class="h-12 w-full" />
      </div>
    {:else if $passkeyQuery.error}
      <Alert.Root variant="destructive">
        <Alert.Title>{copy.settings.passkeys.loadErrorTitle}</Alert.Title>
        <Alert.Description>
          {copy.settings.passkeys.loadErrorDescription}
        </Alert.Description>
        <Alert.Action>
          <Button
            onclick={() => {
              void $passkeyQuery.refetch();
            }}
            size="sm"
            type="button"
            variant="outline"
          >
            {copy.settings.passkeys.retry}
          </Button>
        </Alert.Action>
      </Alert.Root>
    {:else if passkeys.length === 0}
      <Empty.Root>
        <Empty.Header>
          <Empty.Media variant="icon"><Fingerprint /></Empty.Media>
          <Empty.Title>{copy.settings.passkeys.emptyTitle}</Empty.Title>
          <Empty.Description>
            {copy.settings.passkeys.emptyDescription}
          </Empty.Description>
        </Empty.Header>
      </Empty.Root>
    {:else}
      <Item.Group>
        {#each passkeys as passkey (passkey.id)}
          <SettingsPasskeyRow
            {copy}
            {passkey}
            reportStatus={(nextStatus) => {
              status = nextStatus;
            }}
          />
        {/each}
      </Item.Group>
    {/if}
  </Card.Content>
</Card.Root>
