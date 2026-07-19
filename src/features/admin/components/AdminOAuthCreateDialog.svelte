<script lang="ts">
import type { SubmitFunction } from "@sveltejs/kit";
import { enhance } from "$app/forms";
import { Button } from "$lib/components/ui/button/index.js";
import { Checkbox } from "$lib/components/ui/checkbox/index.js";
import * as Dialog from "$lib/components/ui/dialog/index.js";
import * as Field from "$lib/components/ui/field/index.js";
import { Input } from "$lib/components/ui/input/index.js";
import { Spinner } from "$lib/components/ui/spinner/index.js";
import { Textarea } from "$lib/components/ui/textarea/index.js";
import * as ToggleGroup from "$lib/components/ui/toggle-group/index.js";
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
    onOpenChange={(nextOpen) => {
      if (!nextOpen) close();
    }}
  >
    <Dialog.Content
      class="grid-rows-[auto_minmax(0,1fr)] max-h-[calc(100vh-2rem)] max-w-2xl overflow-hidden sm:max-w-2xl"
      aria-labelledby="oauth-create-title"
    >
      <Dialog.Header>
        <Dialog.Title id="oauth-create-title">{copy.createClient}</Dialog.Title>
        <Dialog.Description>{copy.createClientDescription}</Dialog.Description>
      </Dialog.Header>
      <form
        method="POST"
        action="?/createClient"
        class="flex min-h-0 flex-col gap-4 overflow-hidden"
        use:enhance={createClientAction}
      >
        <div class="min-h-0 overflow-y-auto px-1">
          <Field.Set>
            <Field.Group>
              <Field.Field>
                <Field.Title id="admin-oauth-auth-pattern-label">
                  {copy.clientType}
                </Field.Title>
                <Field.Description>{copy.createFlowIntro}</Field.Description>
                <ToggleGroup.Root
                  aria-labelledby="admin-oauth-auth-pattern-label"
                  class="grid w-full gap-2 sm:grid-cols-3"
                  spacing={2}
                  type="single"
                  value={selectedAuthMethod}
                  variant="outline"
                  onValueChange={(value) => {
                    if (typeof value === "string" && value) {
                      selectedAuthMethod = value;
                    }
                  }}
                >
                  {#each authPatterns as option}
                    <ToggleGroup.Item
                      class="h-auto min-h-10 w-full whitespace-normal px-3 py-2"
                      value={option.value}
                    >
                      {oauthCopy(option.titleKey)}
                    </ToggleGroup.Item>
                  {/each}
                </ToggleGroup.Root>
                <input
                  type="hidden"
                  name="tokenEndpointAuthMethod"
                  value={selectedAuthMethod}
                />
                <Field.Description aria-live="polite">
                  {oauthCopy(selectedAuthPattern.descriptionKey)}
                </Field.Description>
              </Field.Field>

              <Field.Field>
                <Field.Label for="admin-oauth-client-name">
                  {copy.clientName}
                </Field.Label>
                <Input
                  id="admin-oauth-client-name"
                  name="name"
                  autocomplete="off"
                  placeholder={copy.clientNamePlaceholder}
                  required
                />
              </Field.Field>

              <Field.Field>
                <div class="flex flex-wrap items-center justify-between gap-2">
                  <Field.Label for="admin-oauth-redirect-uris">
                    {copy.redirectUris}
                  </Field.Label>
                  <Field.Description aria-live="polite">
                    {redirectCountLabel(parsedRedirectUris.length)}
                  </Field.Description>
                </div>
                <Textarea
                  id="admin-oauth-redirect-uris"
                  bind:value={redirectDraft}
                  class="min-h-24"
                  name="redirectUris"
                  placeholder={copy.redirectUrisPlaceholder}
                  required
                />
                <Field.Description>{copy.redirectUrisHint}</Field.Description>
              </Field.Field>

              <Field.Set>
                <div class="flex flex-wrap items-center justify-between gap-2">
                  <Field.Legend variant="label">
                    {copy.permissionsTitle}
                  </Field.Legend>
                  <Field.Description aria-live="polite">
                    {scopeCountLabel(selectedScopes.length)}
                  </Field.Description>
                </div>
                <Field.Description>{copy.permissionsHint}</Field.Description>
                <Field.Group class="grid gap-2 sm:grid-cols-2">
                  {#each scopeOptions as scope}
                    {@const scopeId = `admin-oauth-scope-${scope.value.replace(/:/g, "-")}`}
                    <Field.Field orientation="horizontal">
                      <Checkbox
                        id={scopeId}
                        checked={selectedScopes.includes(scope.value)}
                        onCheckedChange={(checked) =>
                          toggleScope(scope.value, checked)}
                      />
                      <Field.Label for={scopeId} class="cursor-pointer">
                        {scopeLabel(scope.value)}
                      </Field.Label>
                    </Field.Field>
                  {/each}
                </Field.Group>
                {#each selectedScopes as scope}
                  <input type="hidden" name="scopes" value={scope} />
                {/each}
              </Field.Set>
            </Field.Group>
          </Field.Set>
        </div>

        <Dialog.Footer>
          <Button
            type="button"
            variant="outline"
            disabled={isCreatingClient}
            onclick={close}
          >
            {copy.cancel}
          </Button>
          <Button
            type="submit"
            disabled={isCreatingClient || selectedScopes.length === 0}
          >
            {#if isCreatingClient}
              <Spinner data-icon="inline-start" />
            {/if}
            {isCreatingClient ? copy.creating : copy.createClient}
          </Button>
        </Dialog.Footer>
      </form>
    </Dialog.Content>
  </Dialog.Root>
{/if}
