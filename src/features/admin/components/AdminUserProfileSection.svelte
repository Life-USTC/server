<script lang="ts">
import { Checkbox } from "$lib/components/ui/checkbox/index.js";
import { Input } from "$lib/components/ui/input/index.js";
import type { AdminUsersCopy } from "./admin-user-types";

export let copy: AdminUsersCopy;
export let editIsAdmin: boolean;
export let editName: string;
export let editUsername: string;
export let inputValue: (event: Event) => string;
</script>

<section class="grid gap-3 rounded-md border border-base-300 bg-base-200/40 p-3">
  <div>
    <h3 class="font-medium">{copy.profileRoleTitle}</h3>
    <p class="text-base-content/60 text-sm">{copy.profileRoleDescription}</p>
  </div>
  <div class="grid gap-3 sm:grid-cols-2">
    <label class="grid gap-2">
      <span class="font-medium text-sm">{copy.nameLabel}</span>
      <Input
        placeholder={copy.name}
        value={editName}
        oninput={(event: Event) => (editName = inputValue(event))}
      />
    </label>
    <label class="grid gap-2">
      <span class="font-medium text-sm">{copy.usernameLabel}</span>
      <Input
        placeholder={copy.username}
        value={editUsername}
        oninput={(event: Event) => (editUsername = inputValue(event))}
      />
    </label>
  </div>
  <label class="flex w-fit cursor-pointer items-center gap-3 rounded-md border border-base-300 bg-base-100 p-3">
    <Checkbox
      checked={editIsAdmin}
      onchange={(event) => (editIsAdmin = event.currentTarget.checked)}
    />
    <span class="font-medium text-sm">{copy.adminToggleLabel}</span>
  </label>
</section>
