<script lang="ts">
import KeyRoundIcon from "@lucide/svelte/icons/key-round";
import TrashIcon from "@lucide/svelte/icons/trash-2";
import type { SubmitFunction } from "@sveltejs/kit";
import {
  oauthFeatureLabel,
  oauthScopeLabel,
} from "@/features/oauth/lib/oauth-copy";
import type { AppLocale } from "@/i18n/config";
import { enhance } from "$app/forms";
import * as AlertDialog from "$lib/components/ui/alert-dialog/index.js";
import { Badge } from "$lib/components/ui/badge/index.js";
import { Button } from "$lib/components/ui/button/index.js";
import * as Empty from "$lib/components/ui/empty/index.js";
import * as Item from "$lib/components/ui/item/index.js";
import { Spinner } from "$lib/components/ui/spinner/index.js";
import type {
  SettingsCopy,
  SettingsOAuthAuthorization,
} from "./settings-component-types";

export let authorizations: SettingsOAuthAuthorization[];
export let copy: SettingsCopy;
export let locale: AppLocale;

let pendingAuthorization: SettingsOAuthAuthorization | null = null;
let revokingConsentId: string | null = null;

const dateFormatter = new Intl.DateTimeFormat(locale, {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Shanghai",
});

function clientName(authorization: SettingsOAuthAuthorization) {
  return (
    authorization.clientName?.trim() ||
    copy.settings.authorizations.unnamedClient
  );
}

function formatUpdatedAt(value: string) {
  return dateFormatter.format(new Date(value));
}

function revokeAction(consentId: string): SubmitFunction {
  return () => {
    revokingConsentId = consentId;
    return async ({ result, update }) => {
      try {
        if (result.type === "redirect") pendingAuthorization = null;
        await update({ reset: false });
      } finally {
        revokingConsentId = null;
      }
    };
  };
}
</script>

<section
  aria-label={copy.settings.authorizations.title}
  class="grid gap-4"
>
  {#if authorizations.length === 0}
    <Empty.Root>
      <Empty.Header>
        <Empty.Media variant="icon"><KeyRoundIcon /></Empty.Media>
        <Empty.Title>{copy.settings.authorizations.emptyTitle}</Empty.Title>
        <Empty.Description>
          {copy.settings.authorizations.emptyDescription}
        </Empty.Description>
      </Empty.Header>
    </Empty.Root>
  {:else}
    <Item.Group role="list">
      {#each authorizations as authorization}
        <Item.Root role="listitem" variant="outline">
          <Item.Content class="min-w-0">
            <Item.Title>
              {clientName(authorization)}
              {#if authorization.disabled}
                <Badge variant="destructive">
                  {copy.settings.authorizations.disabled}
                </Badge>
              {/if}
            </Item.Title>
            {#if authorization.clientUri}
              <Item.Description class="break-all">
                {authorization.clientUri}
              </Item.Description>
            {/if}
          </Item.Content>
          <Item.Actions class="max-sm:w-full">
            <Button
              class="max-sm:w-full"
              type="button"
              variant="outline"
              onclick={() => {
                pendingAuthorization = authorization;
              }}
            >
              {copy.settings.authorizations.revoke}
            </Button>
          </Item.Actions>
          <Item.Footer class="flex-wrap">
            <div class="flex min-w-0 flex-1 flex-col gap-2">
              <span class="text-muted-foreground text-xs">
                {copy.settings.authorizations.permissions}
              </span>
              <div class="flex flex-wrap gap-1.5">
                {#each authorization.scopes as scope}
                  <Badge variant="outline">
                    {oauthScopeLabel(locale, scope)}
                  </Badge>
                {/each}
              </div>
            </div>
            <span class="text-muted-foreground text-xs">
              {copy.settings.authorizations.updatedAt}:
              {formatUpdatedAt(authorization.updatedAt)}
            </span>
          </Item.Footer>
          <Item.Footer class="block">
            {#if authorization.usage}
              <dl class="grid w-full gap-3 text-xs sm:grid-cols-3">
                <div class="rounded-md bg-muted/50 p-3"><dt class="text-muted-foreground">{copy.settings.authorizations.reads}</dt><dd class="mt-1 text-lg font-semibold tabular-nums">{authorization.usage.readCount}</dd></div>
                <div class="rounded-md bg-muted/50 p-3"><dt class="text-muted-foreground">{copy.settings.authorizations.writes}</dt><dd class="mt-1 text-lg font-semibold tabular-nums">{authorization.usage.writeCount}</dd></div>
                <div class="rounded-md bg-muted/50 p-3"><dt class="text-muted-foreground">{copy.settings.authorizations.errors}</dt><dd class="mt-1 text-lg font-semibold tabular-nums">{authorization.usage.errorCount}</dd></div>
              </dl>
              <dl class="mt-3 grid gap-1.5 text-xs text-muted-foreground sm:grid-cols-3">
                <div><dt>{copy.settings.authorizations.lastUsedAt}</dt><dd class="text-foreground">{formatUpdatedAt(authorization.usage.lastUsedAt)}</dd></div>
                <div><dt>{copy.settings.authorizations.lastChannel}</dt><dd class="text-foreground">{copy.settings.security.channels[authorization.usage.lastChannel] ?? authorization.usage.lastChannel}</dd></div>
                <div><dt>{copy.settings.authorizations.lastFeature}</dt><dd class="text-foreground">{oauthFeatureLabel(locale, authorization.usage.lastFeature)}</dd></div>
              </dl>
            {:else}
              <span>{copy.settings.authorizations.neverUsed}</span>
            {/if}
          </Item.Footer>
        </Item.Root>
      {/each}
    </Item.Group>
  {/if}
</section>

{#if pendingAuthorization}
  <AlertDialog.Root
    open={true}
    onOpenChange={(open) => {
      if (!open && !revokingConsentId) pendingAuthorization = null;
    }}
  >
    <AlertDialog.Content class="max-w-md sm:max-w-md">
      <AlertDialog.Header>
        <AlertDialog.Title>
          {copy.settings.authorizations.revokeTitle}
        </AlertDialog.Title>
        <AlertDialog.Description>
          {copy.settings.authorizations.revokeDescription.replace(
            "{name}",
            clientName(pendingAuthorization),
          )}
        </AlertDialog.Description>
      </AlertDialog.Header>
      <form
        method="POST"
        action="?/revokeAuthorization"
        use:enhance={revokeAction(pendingAuthorization.consentId)}
      >
        <input
          type="hidden"
          name="consentId"
          value={pendingAuthorization.consentId}
        />
        <AlertDialog.Footer>
          <AlertDialog.Cancel
            disabled={Boolean(revokingConsentId)}
            type="button"
            variant="outline"
          >
            {copy.profile.cancel}
          </AlertDialog.Cancel>
          <Button
            disabled={Boolean(revokingConsentId)}
            type="submit"
            variant="destructive"
          >
            {#if revokingConsentId}
              <Spinner
                aria-label={copy.settings.authorizations.revoking}
                data-icon="inline-start"
              />
              {copy.settings.authorizations.revoking}
            {:else}
              <TrashIcon data-icon="inline-start" />
              {copy.settings.authorizations.revoke}
            {/if}
          </Button>
        </AlertDialog.Footer>
      </form>
    </AlertDialog.Content>
  </AlertDialog.Root>
{/if}
