<script lang="ts">
import type { SubmitFunction } from "@sveltejs/kit";
import { enhance } from "$app/forms";
import ShieldCheckIcon from "$lib/components/icons/shield-check.svelte";
import { Alert } from "$lib/components/ui/alert/index.js";
import { Button } from "$lib/components/ui/button/index.js";
import * as Dialog from "$lib/components/ui/dialog/index.js";
import AdminOAuthAuthPatternPicker from "./AdminOAuthAuthPatternPicker.svelte";
import AdminOAuthCreateFields from "./AdminOAuthCreateFields.svelte";
import AdminOAuthScopePicker from "./AdminOAuthScopePicker.svelte";
import type { AdminOAuthCopy } from "./admin-oauth-client-types";
import type {
  AuthPatternOption,
  ScopeOption,
} from "./admin-oauth-create-types";

export let authPatterns: AuthPatternOption[];
export let close: () => void;
export let copy: AdminOAuthCopy;
export let createClientAction: SubmitFunction;
export let isCreatingClient: boolean;
export let oauthCopy: (key: string) => string;
export let open: boolean;
export let parsedRedirectUris: string[];
export let redirectCountLabel: (count: number) => string;
export let redirectDraft: string;
export let scopeCountLabel: (count: number) => string;
export let scopeLabel: (scope: string) => string;
export let scopeOptions: ScopeOption[];
export let selectedAuthMethod: string;
export let selectedAuthPattern: AuthPatternOption;
export let selectedScopes: string[];
export let toggleScope: (scope: string, checked: boolean) => void;
</script>

{#if open}
  <Dialog.Root
    open={true}
    class="!max-w-4xl"
    aria-labelledby="oauth-create-title"
    onOpenChange={(nextOpen) => {
      if (!nextOpen) close();
    }}
  >
    <Dialog.Header>
      <Dialog.Title id="oauth-create-title">{copy.createClient}</Dialog.Title>
      <Dialog.Description>{copy.createClientDescription}</Dialog.Description>
    </Dialog.Header>
    <form
      method="POST"
      action="?/createClient"
      class="grid max-h-[min(78vh,48rem)] gap-5 overflow-y-auto px-5 py-4"
      use:enhance={createClientAction}
    >
      <AdminOAuthAuthPatternPicker
        {authPatterns}
        {copy}
        {oauthCopy}
        bind:selectedAuthMethod
      />

      <Alert class="flex items-start gap-2" variant="info">
        <ShieldCheckIcon class="mt-0.5 text-info" />
        <div class="grid gap-1">
          <h3 class="font-semibold">{copy.panelSecurityTitle}</h3>
          <p>{copy.panelSecurityDescription}</p>
        </div>
      </Alert>

      <div class="grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
        <AdminOAuthCreateFields
          {copy}
          {parsedRedirectUris}
          {redirectCountLabel}
          bind:redirectDraft
        />

        <AdminOAuthScopePicker
          {copy}
          {oauthCopy}
          {scopeCountLabel}
          {scopeLabel}
          {scopeOptions}
          {selectedAuthPattern}
          {selectedScopes}
          {toggleScope}
        />
      </div>

      <Dialog.Footer class="px-0 pb-0">
        <p class="mr-auto max-w-md text-base-content/60 text-xs leading-5">
          {copy.createClientFootnote}
        </p>
        <Button type="button" variant="outline" disabled={isCreatingClient} onclick={close}>{copy.cancel}</Button>
        <Button type="submit" disabled={isCreatingClient || selectedScopes.length === 0}>
          {isCreatingClient ? copy.creating : copy.createClient}
        </Button>
      </Dialog.Footer>
    </form>
  </Dialog.Root>
{/if}
