<script lang="ts">
import { Badge } from "$lib/components/ui/badge/index.js";
import { Button } from "$lib/components/ui/button/index.js";
import * as Table from "$lib/components/ui/table/index.js";
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

<div class="hidden md:block">
  <Table.Root>
    <Table.Header>
      <Table.Row>
        <Table.Head>{copy.name}</Table.Head>
        <Table.Head>{copy.username}</Table.Head>
        <Table.Head>{copy.email}</Table.Head>
        <Table.Head>{copy.role}</Table.Head>
        <Table.Head>{copy.suspension}</Table.Head>
        <Table.Head>{copy.createdAt}</Table.Head>
        <Table.Head class="w-24 text-right">{copy.editTitle}</Table.Head>
      </Table.Row>
    </Table.Header>
    <Table.Body>
      {#each users as user}
        <Table.Row>
          <Table.Cell>
            <div class="font-medium">{displayName(user)}</div>
            <div class="break-all font-mono text-muted-foreground text-xs">{user.id}</div>
          </Table.Cell>
          <Table.Cell>{user.username ?? copy.noUsername}</Table.Cell>
          <Table.Cell>{user.email ?? copy.noVerifiedEmail}</Table.Cell>
          <Table.Cell>
            <Badge variant={user.isAdmin ? "secondary" : "ghost"}>
              {user.isAdmin ? copy.adminRole : copy.userRole}
            </Badge>
          </Table.Cell>
          <Table.Cell>
            {#if user.activeSuspension}
              <div class="grid gap-1">
                <Badge class="w-fit" variant="destructive">{copy.suspendedStatus}</Badge>
                <span class="text-muted-foreground text-xs">{suspensionLabel(user)}</span>
              </div>
            {:else}
              <Badge variant="ghost">{copy.clearStatus}</Badge>
            {/if}
          </Table.Cell>
          <Table.Cell>{formatDate(user.createdAt)}</Table.Cell>
          <Table.Cell class="text-right">
            <Button
              size="sm"
              type="button"
              variant="outline"
              onclick={() => onSelect(user)}
            >
              {copy.editTitle}
            </Button>
          </Table.Cell>
        </Table.Row>
      {/each}
    </Table.Body>
  </Table.Root>
</div>
