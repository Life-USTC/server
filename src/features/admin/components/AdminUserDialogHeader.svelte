<script lang="ts">
import { Badge } from "$lib/components/ui/badge/index.js";
import * as Dialog from "$lib/components/ui/dialog/index.js";
import type { AdminUserRow, AdminUsersCopy } from "./admin-user-types";

export let copy: AdminUsersCopy;
export let user: AdminUserRow;
</script>

<Dialog.Header class="pr-10">
  <div class="flex min-w-0 flex-wrap items-start justify-between gap-3">
    <div class="min-w-0 flex-1">
      <Dialog.Title id="admin-user-dialog-title">
        {copy.editTitle}
      </Dialog.Title>
      <Dialog.Description class="break-all">
        {user.id}
      </Dialog.Description>
    </div>
    <div class="flex shrink-0 flex-wrap gap-2">
      <Badge
        variant={user.isAdmin ? "secondary" : "ghost"}
      >
        {user.isAdmin ? copy.adminRole : copy.userRole}
      </Badge>
      {#if user.activeSuspension}
        <Badge variant="destructive">
          {copy.suspendedStatus}
        </Badge>
      {/if}
    </div>
  </div>
</Dialog.Header>
