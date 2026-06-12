<script lang="ts">
import { Badge } from "$lib/components/ui/badge/index.js";
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
      </Table.Row>
    </Table.Header>
    <Table.Body>
      {#each users as user}
        <Table.Row class="cursor-pointer" onclick={() => onSelect(user)}>
          <Table.Cell>
            <div class="font-medium">{displayName(user)}</div>
            <div class="break-all font-mono text-base-content/50 text-xs">{user.id}</div>
          </Table.Cell>
          <Table.Cell>{user.username ?? copy.noUsername}</Table.Cell>
          <Table.Cell class="text-sm">{user.email ?? copy.noVerifiedEmail}</Table.Cell>
          <Table.Cell>
            <Badge class={user.isAdmin ? "border-success bg-success/10 text-success" : ""} variant={user.isAdmin ? "outline" : "ghost"}>
              {user.isAdmin ? copy.adminRole : copy.userRole}
            </Badge>
          </Table.Cell>
          <Table.Cell>
            {#if user.activeSuspension}
              <div class="grid gap-1">
                <Badge class="w-fit border-warning bg-warning/10 text-warning" variant="outline">{copy.suspendedStatus}</Badge>
                <span class="text-base-content/60 text-xs">{suspensionLabel(user)}</span>
              </div>
            {:else}
              <Badge variant="ghost">{copy.clearStatus}</Badge>
            {/if}
          </Table.Cell>
          <Table.Cell class="text-base-content/60 text-sm">{formatDate(user.createdAt)}</Table.Cell>
        </Table.Row>
      {/each}
    </Table.Body>
  </Table.Root>
</div>
