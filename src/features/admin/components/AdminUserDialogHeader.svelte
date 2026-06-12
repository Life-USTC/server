<script lang="ts">
import { Badge } from "$lib/components/ui/badge/index.js";
import * as Dialog from "$lib/components/ui/dialog/index.js";
import type { AdminUserRow, AdminUsersCopy } from "./admin-user-types";

export let copy: AdminUsersCopy;
export let user: AdminUserRow;
</script>

<Dialog.Header>
  <div class="flex flex-wrap items-start justify-between gap-3">
    <div class="min-w-0">
      <Dialog.Title id="admin-user-dialog-title">
        {copy.editTitle}
      </Dialog.Title>
      <Dialog.Description class="break-all font-mono text-xs">
        {user.id}
      </Dialog.Description>
    </div>
    <div class="flex flex-wrap gap-2">
      <Badge
        class={user.isAdmin
          ? "border-success bg-success/10 text-success"
          : ""}
        variant={user.isAdmin ? "outline" : "ghost"}
      >
        {user.isAdmin ? copy.adminRole : copy.userRole}
      </Badge>
      {#if user.activeSuspension}
        <Badge class="border-warning bg-warning/10 text-warning" variant="outline">
          {copy.suspendedStatus}
        </Badge>
      {/if}
    </div>
  </div>
</Dialog.Header>
