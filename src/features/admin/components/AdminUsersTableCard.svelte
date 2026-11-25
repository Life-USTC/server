<script lang="ts">
import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";
import SquarePen from "@lucide/svelte/icons/square-pen";
import CollectionEmpty from "#lib/components/CollectionEmpty.svelte";
import CollectionListShell from "#lib/components/CollectionListShell.svelte";
import CollectionTableShell from "#lib/components/CollectionTableShell.svelte";
import MobileListCard from "#lib/components/MobileListCard.svelte";
import ResponsiveCollection from "#lib/components/ResponsiveCollection.svelte";
import TableControlsRow from "#lib/components/TableControlsRow.svelte";
import TableFieldFilter from "#lib/components/TableFieldFilter.svelte";
import TableIconButton from "#lib/components/TableIconButton.svelte";
import TableRowActions from "#lib/components/TableRowActions.svelte";
import TruncatedText from "#lib/components/TruncatedText.svelte";
import { Badge } from "#lib/components/ui/badge/index.js";
import { Button } from "#lib/components/ui/button/index.js";
import * as Item from "#lib/components/ui/item/index.js";
import * as Table from "#lib/components/ui/table/index.js";
import { adminUserTableFields } from "../lib/admin-user-table-filters";
import AdminUsersSearchCard from "./AdminUsersSearchCard.svelte";
import type {
  AdminUserFormatter,
  AdminUserRow,
  AdminUsersCommonCopy,
  AdminUsersCopy,
} from "./admin-user-types";

export let commonCopy: AdminUsersCommonCopy;
export let values: Record<string, string>;
export let onchange: (patch: Record<string, string>) => void;
export let onapply: (event: SubmitEvent) => void;
export let copy: AdminUsersCopy & {
  accountsDescription: string;
  accountsTitle: string;
  noResults: string;
};
export let displayName: AdminUserFormatter;
export let formatDate: (value: Date | string | null | undefined) => string;
export let onSelect: (user: AdminUserRow) => void;
export let suspensionLabel: AdminUserFormatter;
export let users: AdminUserRow[];
$: fields = adminUserTableFields(copy);
</script>

{#snippet roleBadge(user: AdminUserRow)}
  <Badge variant={user.isAdmin ? "secondary" : "ghost"}>{user.isAdmin ? copy.adminRole : copy.userRole}</Badge>
{/snippet}

{#snippet column(index: number, view: "mobile" | "desktop" = "desktop")}
  <TableFieldFilter label={fields[index].label} fields={[fields[index]]} {values} {onchange} labels={commonCopy.tableFilters} idPrefix={`admin-users-${view}-${fields[index].name}`} formId={`admin-user-search-${view}-form`} />
{/snippet}

<section class="grid min-w-0 gap-3">
    <ResponsiveCollection>
      {#snippet mobile()}
        <div class="mb-3 flex flex-wrap items-center gap-2" data-slot="collection-header">
          <AdminUsersSearchCard id="admin-user-search-mobile" {commonCopy} {copy} {values} {onchange} {onapply} />
          {#each fields as _, index}{@render column(index, "mobile")}{/each}
        </div>
        {#if users.length === 0}<CollectionEmpty variant="compact" description={copy.noResults} />{:else}
        <CollectionListShell>
          <Item.Group class="gap-0" data-testid="admin-users-mobile-list">
            {#each users as user, index (user.id)}
              <MobileListCard>
                <Item.Content class="min-w-0">
                  <Item.Title>{displayName(user)}</Item.Title>
                  <Item.Description>
                    @{user.username ?? copy.noUsername}
                  </Item.Description>
                  {@const email = user.email ?? copy.noVerifiedEmail}
                  <Item.Description class="truncate" title={email}>
                    {email}
                  </Item.Description>
                  <Item.Footer class="block pt-1">
                    <dl class="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <dt class="text-muted-foreground">{copy.role}</dt>
                        <dd>
                          {@render roleBadge(user)}
                        </dd>
                      </div>
                      <div class="text-right">
                        <dt class="text-muted-foreground">{copy.createdAt}</dt>
                        <dd class="tabular-nums">{formatDate(user.createdAt)}</dd>
                      </div>
                      <div class="text-right">
                        <dt class="text-muted-foreground">{copy.suspension}</dt>
                        <dd>
                          {#if user.activeSuspension}
                            <Badge class="mb-1 ml-auto" variant="destructive">{copy.suspendedStatus}</Badge>
                            <span class="block truncate text-muted-foreground" title={suspensionLabel(user)}>
                              {suspensionLabel(user)}
                            </span>
                          {:else}
                            {copy.clearStatus}
                          {/if}
                        </dd>
                      </div>
                    </dl>
                  </Item.Footer>
                </Item.Content>
                <Item.Actions class="shrink-0 self-start">
                  <Button
                    aria-label={copy.editTitle}
                    onclick={() => onSelect(user)}
                    size="sm"
                    type="button"
                    variant="ghost"
                  >
                    {copy.editTitle}
                    <ChevronRightIcon aria-hidden="true" data-icon="inline-end" />
                  </Button>
                </Item.Actions>
              </MobileListCard>
              {#if index < users.length - 1}<Item.Separator class="my-0" />{/if}
            {/each}
          </Item.Group>
        </CollectionListShell>
        {/if}
      {/snippet}
      {#snippet desktop()}
        <div class="min-w-0">
          <CollectionTableShell label={copy.title}>
            <Table.Root class="w-full min-w-[56rem]">
              <Table.Caption class="sr-only">{copy.title}</Table.Caption>
              <Table.Header>
                <TableControlsRow colspan={7}>
                  <AdminUsersSearchCard id="admin-user-search-desktop" {commonCopy} {copy} {values} {onchange} {onapply} />
                </TableControlsRow>
                <Table.Row>
                  <Table.Head class="w-[22%]">{@render column(0)}</Table.Head>
                  <Table.Head class="w-[18%]">{@render column(1)}</Table.Head>
                  <Table.Head class="w-[25%]">{@render column(2)}</Table.Head>
                  <Table.Head class="w-[9%]">{@render column(3)}</Table.Head>
                  <Table.Head class="w-[14%]">{@render column(4)}</Table.Head>
                  <Table.Head class="w-[12%]">{@render column(5)}</Table.Head>
                  <Table.Head class="w-14 min-w-14">
                    <span class="sr-only">{copy.editTitle}</span>
                  </Table.Head>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {#each users as user}
                  <Table.Row class="group">
                    <Table.Cell class="max-w-0">
                      {@const name = displayName(user)}
                      <span class="block max-w-full" title={name}>
                        <TruncatedText class="font-medium" text={name} />
                      </span>
                    </Table.Cell>
                    <Table.Cell class="max-w-0">
                      {@const username = user.username ?? copy.noUsername}
                      <span class="block max-w-full truncate text-sm" title={username}>
                        {username}
                      </span>
                    </Table.Cell>
                    <Table.Cell class="max-w-0">
                      {@const email = user.email ?? copy.noVerifiedEmail}
                      <span class="block max-w-full" title={email}>
                        <TruncatedText text={email} />
                      </span>
                    </Table.Cell>
                    <Table.Cell class="text-left">
                      {@render roleBadge(user)}
                    </Table.Cell>
                    <Table.Cell class="text-left">
                      {#if user.activeSuspension}
                        <div class="grid min-w-0 justify-items-start gap-1">
                          <Badge class="w-fit" variant="destructive">{copy.suspendedStatus}</Badge>
                          <TruncatedText class="text-muted-foreground text-xs" text={suspensionLabel(user)} />
                        </div>
                      {:else}
                        <Badge class="w-fit" variant="ghost">{copy.clearStatus}</Badge>
                      {/if}
                    </Table.Cell>
                    <Table.Cell class="whitespace-nowrap text-left tabular-nums text-muted-foreground">
                      {formatDate(user.createdAt)}
                    </Table.Cell>
                    <Table.Cell class="w-14 min-w-14 text-left">
                      <TableRowActions>
                        <TableIconButton
                          label={copy.editTitle}
                          onclick={() => onSelect(user)}
                        >
                          <SquarePen data-icon="inline-start" />
                        </TableIconButton>
                      </TableRowActions>
                    </Table.Cell>
                  </Table.Row>
                {:else}
                  <Table.Row><Table.Cell colspan={7}><CollectionEmpty variant="compact" description={copy.noResults} /></Table.Cell></Table.Row>
                {/each}
              </Table.Body>
            </Table.Root>
          </CollectionTableShell>
        </div>
      {/snippet}
    </ResponsiveCollection>
</section>
