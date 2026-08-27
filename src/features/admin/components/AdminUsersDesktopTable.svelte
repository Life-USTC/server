<script lang="ts">
import SquarePen from "@lucide/svelte/icons/square-pen";
import TableIconButton from "$lib/components/TableIconButton.svelte";
import TableRowActions from "$lib/components/TableRowActions.svelte";
import TruncatedText from "$lib/components/TruncatedText.svelte";
import { Badge } from "$lib/components/ui/badge/index.js";
import * as Table from "$lib/components/ui/table/index.js";
import AdminTableShell from "./AdminTableShell.svelte";
import type {
  AdminUserFormatter,
  AdminUserRow,
  AdminUsersCopy,
} from "./admin-user-types";

export let copy: AdminUsersCopy;
export let displayName: AdminUserFormatter;
export let formatDate: (value: Date | string | null | undefined) => string;
export let onSelect: (user: AdminUserRow) => void;
export let suspensionLabel: AdminUserFormatter;
export let users: AdminUserRow[];
</script>

<div class="hidden min-w-0 xl:block">
  <AdminTableShell label={copy.title}>
    <Table.Root class="w-full min-w-[56rem]">
      <Table.Caption class="sr-only">{copy.title}</Table.Caption>
      <Table.Header>
        <Table.Row>
          <Table.Head class="w-[22%]">{copy.name}</Table.Head>
          <Table.Head class="w-[18%]">{copy.username}</Table.Head>
          <Table.Head class="w-[25%]">{copy.email}</Table.Head>
          <Table.Head class="w-[9%] text-center">{copy.role}</Table.Head>
          <Table.Head class="w-[14%] text-center">{copy.suspension}</Table.Head>
          <Table.Head class="w-[12%] text-right">{copy.createdAt}</Table.Head>
          <Table.Head class="w-14 min-w-14 text-right">
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
            <Table.Cell class="text-center">
              <Badge variant={user.isAdmin ? "secondary" : "ghost"}>
                {user.isAdmin ? copy.adminRole : copy.userRole}
              </Badge>
            </Table.Cell>
            <Table.Cell class="text-center">
              <div class="grid min-w-0 justify-items-center gap-1">
                {#if user.activeSuspension}
                  <Badge class="w-fit" variant="destructive">{copy.suspendedStatus}</Badge>
                {:else}
                  <Badge class="w-fit" variant="ghost">{copy.clearStatus}</Badge>
                {/if}
                {#if user.activeSuspension}
                  <span class="block max-w-full" title={suspensionLabel(user)}>
                    <TruncatedText
                      class="text-muted-foreground text-xs"
                      text={suspensionLabel(user)}
                    />
                  </span>
                {/if}
              </div>
            </Table.Cell>
            <Table.Cell class="whitespace-nowrap text-right tabular-nums text-muted-foreground">
              {formatDate(user.createdAt)}
            </Table.Cell>
            <Table.Cell class="w-14 min-w-14 text-right">
              <TableRowActions class="justify-end">
                <TableIconButton
                  label={copy.editTitle}
                  onclick={() => onSelect(user)}
                >
                  <SquarePen />
                </TableIconButton>
              </TableRowActions>
            </Table.Cell>
          </Table.Row>
        {/each}
      </Table.Body>
    </Table.Root>
  </AdminTableShell>
</div>
