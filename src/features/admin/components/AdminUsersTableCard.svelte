<script lang="ts">
import SquarePen from "@lucide/svelte/icons/square-pen";
import CollectionEmpty from "#lib/components/CollectionEmpty.svelte";
import CollectionTableShell from "#lib/components/CollectionTableShell.svelte";
import TableControlsRow from "#lib/components/TableControlsRow.svelte";
import TableFieldFilter from "#lib/components/TableFieldFilter.svelte";
import TableIconButton from "#lib/components/TableIconButton.svelte";
import TableRowActions from "#lib/components/TableRowActions.svelte";
import TruncatedText from "#lib/components/TruncatedText.svelte";
import { Badge } from "#lib/components/ui/badge/index.js";
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
export let copy: AdminUsersCopy & { noResults: string };
export let displayName: AdminUserFormatter;
export let formatDate: (value: Date | string | null | undefined) => string;
export let onSelect: (user: AdminUserRow) => void;
export let suspensionLabel: AdminUserFormatter;
export let users: AdminUserRow[];
$: fields = adminUserTableFields(copy);
</script>

{#snippet column(index: number)}
  <TableFieldFilter label={fields[index].label} fields={[fields[index]]} {values} {onchange} labels={commonCopy.tableFilters} idPrefix={`admin-users-${fields[index].name}`} formId="admin-user-search-form" />
{/snippet}

<CollectionTableShell cards label={copy.title}>
  <Table.Root class="w-full min-w-[56rem]">
    <Table.Caption class="sr-only">{copy.title}</Table.Caption>
    <Table.Header>
      <TableControlsRow colspan={7}>
        <AdminUsersSearchCard id="admin-user-search" {commonCopy} {copy} {values} {onchange} {onapply} />
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
          <Table.Cell data-label={fields[0].label} class="max-w-0">
            {@const name = displayName(user)}
            <TruncatedText class="font-medium" text={name} />
          </Table.Cell>
          <Table.Cell data-label={fields[1].label} class="max-w-0">
            {@const username = user.username ?? copy.noUsername}
            <span class="block max-w-full truncate text-sm" title={username}>
              {username}
            </span>
          </Table.Cell>
          <Table.Cell data-label={fields[2].label} class="max-w-0">
            {@const email = user.email ?? copy.noVerifiedEmail}
            <TruncatedText text={email} />
          </Table.Cell>
          <Table.Cell data-label={fields[3].label}>
            <Badge variant={user.isAdmin ? "secondary" : "ghost"}>
              {user.isAdmin ? copy.adminRole : copy.userRole}
            </Badge>
          </Table.Cell>
          <Table.Cell data-label={fields[4].label}>
            {#if user.activeSuspension}
              <div class="grid min-w-0 justify-items-start gap-1">
                <Badge class="w-fit" variant="destructive">{copy.suspendedStatus}</Badge>
                <TruncatedText class="text-muted-foreground text-xs" text={suspensionLabel(user)} />
              </div>
            {:else}
              <Badge class="w-fit" variant="ghost">{copy.clearStatus}</Badge>
            {/if}
          </Table.Cell>
          <Table.Cell data-label={fields[5].label} class="whitespace-nowrap tabular-nums text-muted-foreground">
            {formatDate(user.createdAt)}
          </Table.Cell>
          <Table.Cell>
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
