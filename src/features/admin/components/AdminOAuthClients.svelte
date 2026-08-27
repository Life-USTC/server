<script lang="ts">
import TrashIcon from "@lucide/svelte/icons/trash-2";
import TableIconButton from "$lib/components/TableIconButton.svelte";
import TableRowActions from "$lib/components/TableRowActions.svelte";
import TruncatedBadge from "$lib/components/TruncatedBadge.svelte";
import TruncatedText from "$lib/components/TruncatedText.svelte";
import { Badge } from "$lib/components/ui/badge/index.js";
import * as Empty from "$lib/components/ui/empty/index.js";
import * as Item from "$lib/components/ui/item/index.js";
import * as Table from "$lib/components/ui/table/index.js";
import AdminListShell from "./AdminListShell.svelte";
import AdminTableShell from "./AdminTableShell.svelte";
import type {
  AdminOAuthClient,
  AdminOAuthCopy,
} from "./admin-oauth-client-types";

export let clientTypeLabel: (method: string) => string;
export let clients: AdminOAuthClient[];
export let copy: AdminOAuthCopy;
export let formatCreatedAt: (value: string | Date) => string;
export let onDelete: (client: AdminOAuthClient) => void;
export let scopeLabel: (scope: string) => string;
</script>

<section class="flex min-w-0 flex-col gap-3">
  <div class="flex justify-end">
    <Badge variant="ghost">
      {copy.clientCount.replace("{count}", String(clients.length))}
    </Badge>
  </div>

  {#if clients.length === 0}
    <Empty.Root class="items-start text-left" data-oauth-empty-state>
      <Empty.Header class="items-start text-left">
        <Empty.Title>{copy.noClients}</Empty.Title>
        <Empty.Description>{copy.noClientsDescription}</Empty.Description>
      </Empty.Header>
    </Empty.Root>
  {:else}
    <div class="hidden min-w-0 max-w-full xl:block">
      <AdminTableShell label={copy.existingClientsDescription}>
        <Table.Root class="w-full min-w-[64rem]">
        <Table.Caption class="sr-only">
          {copy.existingClientsDescription}
        </Table.Caption>
        <Table.Header>
          <Table.Row>
            <Table.Head class="w-[29%]">{copy.tableColumnClient}</Table.Head>
            <Table.Head class="w-[25%]">{copy.tableColumnType}</Table.Head>
            <Table.Head class="w-[24%]">{copy.tableColumnScopes}</Table.Head>
            <Table.Head class="w-[15%] text-right">{copy.createdAtLabel}</Table.Head>
            <Table.Head class="w-14 min-w-14 text-right">
              <span class="sr-only">{copy.deleteClient}</span>
            </Table.Head>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {#each clients as client (client.clientId)}
            <Table.Row class="group">
              <Table.Cell class="max-w-0">
                {@const clientName = client.name ?? copy.unnamedClient}
                <div class="flex min-w-0 flex-col gap-1">
                  <span class="block max-w-full" title={clientName}>
                    <TruncatedText class="font-medium" text={clientName} />
                  </span>
                  <span class="block max-w-full" title={client.clientId}>
                    <TruncatedText
                      class="font-mono text-muted-foreground text-xs"
                      text={client.clientId}
                    />
                  </span>
                </div>
              </Table.Cell>
              <Table.Cell>
                <div class="flex flex-nowrap gap-1.5">
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
              <Table.Cell class="max-w-0">
                <TruncatedBadge
                  class="w-full max-w-full"
                  text={client.scopes.length > 0
                    ? client.scopes.join(", ")
                    : copy.notAvailable}
                />
              </Table.Cell>
              <Table.Cell class="whitespace-nowrap text-right tabular-nums text-muted-foreground">
                {formatCreatedAt(client.createdAt)}
              </Table.Cell>
              <Table.Cell class="w-14 min-w-14 text-right">
                <TableRowActions class="justify-end">
                  <TableIconButton
                    label={`${copy.deleteClient}: ${client.name ?? copy.unnamedClient}`}
                    variant="destructive"
                    onclick={() => onDelete(client)}
                  >
                    <TrashIcon />
                  </TableIconButton>
                </TableRowActions>
              </Table.Cell>
            </Table.Row>
          {/each}
        </Table.Body>
        </Table.Root>
      </AdminTableShell>
    </div>

    <AdminListShell class="xl:hidden">
      <Item.Group role="list">
        {#each clients as client (client.clientId)}
          <Item.Root role="listitem" variant="outline" class="items-start">
            <Item.Content class="min-w-0">
              <Item.Title>{client.name ?? copy.unnamedClient}</Item.Title>
              <Item.Description class="truncate font-mono" title={client.clientId}>
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
              <TableIconButton
                label={`${copy.deleteClient}: ${client.name ?? copy.unnamedClient}`}
                variant="destructive"
                onclick={() => onDelete(client)}
              >
                <TrashIcon />
              </TableIconButton>
            </Item.Actions>
          </Item.Root>
        {/each}
      </Item.Group>
    </AdminListShell>
  {/if}
</section>
