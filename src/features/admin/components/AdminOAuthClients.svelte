<script lang="ts">
import TrashIcon from "@lucide/svelte/icons/trash-2";
import { Badge } from "$lib/components/ui/badge/index.js";
import { Button } from "$lib/components/ui/button/index.js";
import * as Empty from "$lib/components/ui/empty/index.js";
import * as Item from "$lib/components/ui/item/index.js";
import * as Table from "$lib/components/ui/table/index.js";
import type {
  AdminOAuthClient,
  AdminOAuthCopy,
} from "./admin-oauth-client-types";

export let clientTypeLabel: (method: string) => string;
export let clients: AdminOAuthClient[];
export let copy: AdminOAuthCopy;
export let createDisabled: boolean;
export let formatCreatedAt: (value: string | Date) => string;
export let onDelete: (client: AdminOAuthClient) => void;
export let onCreate: () => void;
export let scopeLabel: (scope: string) => string;
</script>

<section class="flex min-w-0 flex-col gap-3">
  <div class="flex min-w-0 items-start justify-between gap-3">
    <div class="min-w-0">
      <h2 class="font-semibold text-lg">{copy.existingClients}</h2>
      <p class="text-muted-foreground text-sm">
        {copy.existingClientsDescription}
      </p>
    </div>
    <Badge variant="secondary">
      {copy.clientCount.replace("{count}", String(clients.length))}
    </Badge>
  </div>

  {#if clients.length === 0}
    <Empty.Root class="items-start text-left" data-oauth-empty-state>
      <Empty.Header class="items-start text-left">
        <Empty.Title>{copy.noClients}</Empty.Title>
        <Empty.Description>{copy.noClientsDescription}</Empty.Description>
      </Empty.Header>
      <Empty.Content class="items-start">
        <Button disabled={createDisabled} onclick={onCreate}>
          {copy.createClient}
        </Button>
      </Empty.Content>
    </Empty.Root>
  {:else}
    <div class="hidden min-w-0 max-w-full xl:block">
      <Table.Root>
        <Table.Caption class="sr-only">
          {copy.existingClientsDescription}
        </Table.Caption>
        <Table.Header>
          <Table.Row>
            <Table.Head>{copy.tableColumnClient}</Table.Head>
            <Table.Head>{copy.tableColumnType}</Table.Head>
            <Table.Head>{copy.tableColumnScopes}</Table.Head>
            <Table.Head>{copy.createdAtLabel}</Table.Head>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {#each clients as client (client.clientId)}
            <Table.Row>
              <Table.Cell class="max-w-64 whitespace-normal">
                <div class="flex min-w-0 flex-col gap-1">
                  <span class="font-medium">
                    {client.name ?? copy.unnamedClient}
                  </span>
                  <code class="truncate text-muted-foreground text-xs" title={client.clientId}>
                    {client.clientId}
                  </code>
                </div>
              </Table.Cell>
              <Table.Cell class="whitespace-normal">
                <div class="flex max-w-56 flex-wrap gap-1.5">
                  <Badge variant={client.skipConsent ? "secondary" : "outline"}>
                    {client.skipConsent
                      ? copy.clientTrustTrusted
                      : copy.clientTrustConsent}
                  </Badge>
                  <Badge variant="ghost">
                    {clientTypeLabel(client.tokenEndpointAuthMethod)}
                  </Badge>
                  <Badge variant={client.disabled ? "destructive" : "default"}>
                    {client.disabled ? copy.disabled : copy.enabled}
                  </Badge>
                </div>
              </Table.Cell>
              <Table.Cell class="max-w-72 whitespace-normal">
                <div class="flex flex-wrap gap-1.5">
                  {#each client.scopes.slice(0, 3) as scope}
                    <Badge variant="outline" title={scopeLabel(scope)}>
                      {scope}
                    </Badge>
                  {:else}
                    <span class="text-muted-foreground">{copy.notAvailable}</span>
                  {/each}
                  {#if client.scopes.length > 3}
                    <Badge variant="ghost">
                      {copy.scopeSummaryMore.replace(
                        "{count}",
                        String(client.scopes.length - 3),
                      )}
                    </Badge>
                  {/if}
                </div>
              </Table.Cell>
              <Table.Cell>
                <div class="flex flex-col items-start gap-2">
                  <span>{formatCreatedAt(client.createdAt)}</span>
                  <Button
                    aria-label={`${copy.deleteClient}: ${client.name ?? copy.unnamedClient}`}
                    size="sm"
                    type="button"
                    variant="destructive"
                    onclick={() => onDelete(client)}
                  >
                    <TrashIcon data-icon="inline-start" />
                    <span>{copy.deleteClient}</span>
                  </Button>
                </div>
              </Table.Cell>
            </Table.Row>
          {/each}
        </Table.Body>
      </Table.Root>
    </div>

    <div class="xl:hidden">
      <Item.Group>
        {#each clients as client (client.clientId)}
          <Item.Root role="listitem" variant="outline" class="items-start">
            <Item.Content class="min-w-0">
              <Item.Title>{client.name ?? copy.unnamedClient}</Item.Title>
              <Item.Description class="break-all font-mono">
                {client.clientId}
              </Item.Description>
              <div class="flex flex-wrap gap-1.5">
                <Badge variant={client.skipConsent ? "secondary" : "outline"}>
                  {client.skipConsent
                    ? copy.clientTrustTrusted
                    : copy.clientTrustConsent}
                </Badge>
                <Badge variant="ghost">
                  {clientTypeLabel(client.tokenEndpointAuthMethod)}
                </Badge>
                <Badge variant={client.disabled ? "destructive" : "default"}>
                  {client.disabled ? copy.disabled : copy.enabled}
                </Badge>
              </div>
              <div class="flex flex-wrap gap-1.5">
                {#each client.scopes.slice(0, 2) as scope}
                  <Badge variant="outline" title={scopeLabel(scope)}>
                    {scope}
                  </Badge>
                {:else}
                  <span class="text-muted-foreground">{copy.notAvailable}</span>
                {/each}
                {#if client.scopes.length > 2}
                  <Badge variant="ghost">
                    {copy.scopeSummaryMore.replace(
                      "{count}",
                      String(client.scopes.length - 2),
                    )}
                  </Badge>
                {/if}
              </div>
              <Item.Description>
                {copy.createdAtLabel}: {formatCreatedAt(client.createdAt)}
              </Item.Description>
            </Item.Content>
            <Item.Actions class="w-full justify-end">
              <Button
                aria-label={`${copy.deleteClient}: ${client.name ?? copy.unnamedClient}`}
                size="sm"
                type="button"
                variant="destructive"
                onclick={() => onDelete(client)}
              >
                <TrashIcon data-icon="inline-start" />
                <span>{copy.deleteClient}</span>
              </Button>
            </Item.Actions>
          </Item.Root>
        {/each}
      </Item.Group>
    </div>
  {/if}
</section>
