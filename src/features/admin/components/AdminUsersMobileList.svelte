<script lang="ts">
import { Badge } from "$lib/components/ui/badge/index.js";
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

<div class="grid gap-3 md:hidden">
  {#each users as user}
    <button
      class={`rounded-md border border-base-300 border-l-4 bg-base-100 p-4 text-left transition-colors hover:border-primary/50 hover:bg-base-200/40 focus:outline-none focus:ring-2 focus:ring-primary/30 ${user.activeSuspension ? "border-l-warning" : user.isAdmin ? "border-l-success" : "border-l-primary"}`}
      type="button"
      onclick={() => onSelect(user)}
    >
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <div class="truncate font-semibold">{displayName(user)}</div>
          <div class="text-base-content/60 text-sm">@{user.username ?? copy.noUsername}</div>
          <div class="mt-1 break-words text-base-content/60 text-xs">{user.email ?? copy.noVerifiedEmail}</div>
        </div>
        <Badge class={user.isAdmin ? "border-success bg-success/10 text-success" : ""} variant={user.isAdmin ? "outline" : "ghost"}>
          {user.isAdmin ? copy.adminRole : copy.userRole}
        </Badge>
      </div>
      <dl class="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div>
          <dt class="text-base-content/60">{copy.createdAt}</dt>
          <dd class="tabular-nums">{formatDate(user.createdAt)}</dd>
        </div>
        <div>
          <dt class="text-base-content/60">{copy.suspension}</dt>
          <dd>{suspensionLabel(user)}</dd>
        </div>
      </dl>
    </button>
  {/each}
</div>
