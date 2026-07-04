<script lang="ts">
import { Checkbox } from "$lib/components/ui/checkbox/index.js";
import * as Field from "$lib/components/ui/field/index.js";
import { Input } from "$lib/components/ui/input/index.js";
import type { AdminUsersCopy } from "./admin-user-types";

export let copy: AdminUsersCopy;
export let editIsAdmin: boolean;
export let editName: string;
export let editUsername: string;
export let inputValue: (event: Event) => string;
</script>

<section class="grid gap-3 rounded-md border border-base-300 bg-base-200/40 p-3">
  <Field.Set>
    <Field.Legend>{copy.profileRoleTitle}</Field.Legend>
    <Field.Description>{copy.profileRoleDescription}</Field.Description>
    <Field.Group class="grid gap-3 sm:grid-cols-2">
      <Field.Field>
        <Field.Label for="admin-user-name">{copy.nameLabel}</Field.Label>
        <Input
          id="admin-user-name"
          placeholder={copy.name}
          value={editName}
          oninput={(event: Event) => (editName = inputValue(event))}
        />
      </Field.Field>
      <Field.Field>
        <Field.Label for="admin-user-username">
          {copy.usernameLabel}
        </Field.Label>
        <Input
          id="admin-user-username"
          placeholder={copy.username}
          value={editUsername}
          oninput={(event: Event) => (editUsername = inputValue(event))}
        />
      </Field.Field>
    </Field.Group>
  </Field.Set>
  <Field.Field
    class="w-fit rounded-md border border-base-300 bg-base-100 p-3"
    orientation="horizontal"
  >
    <Checkbox id="admin-user-is-admin" bind:checked={editIsAdmin} />
    <Field.Label for="admin-user-is-admin" class="font-normal">
      {copy.adminToggleLabel}
    </Field.Label>
  </Field.Field>
</section>
