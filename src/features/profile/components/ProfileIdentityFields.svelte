<script lang="ts">
import {
  PROFILE_USERNAME_MAX_LENGTH,
  PROFILE_USERNAME_PATTERN,
} from "@/features/profile/lib/profile-username";
import * as Field from "$lib/components/ui/field/index.js";
import { Input } from "$lib/components/ui/input/index.js";
import type {
  ProfileFormUser,
  ProfileIdentityCopy,
} from "./profile-form-types";

export let copy: ProfileIdentityCopy;
export let user: ProfileFormUser;
export let disabled = false;
export let showUsernameRequiredIndicator = true;
</script>

<Field.Field data-disabled={disabled ? "true" : undefined}>
  <Field.Label for="name">
    {copy.name} <span class="text-destructive">*</span>
  </Field.Label>
  <Input
    id="name"
    name="name"
    value={user.name ?? ""}
    placeholder={copy.namePlaceholder}
    autocomplete="name"
    required
    {disabled}
  />
</Field.Field>

<Field.Field data-disabled={disabled ? "true" : undefined}>
  <Field.Label for="username">
    {copy.username}
    {#if showUsernameRequiredIndicator}<span class="text-destructive">*</span>{/if}
  </Field.Label>
  <Input
    id="username"
    name="username"
    value={user.username ?? ""}
    placeholder={copy.usernamePlaceholder}
    pattern={PROFILE_USERNAME_PATTERN}
    maxlength={PROFILE_USERNAME_MAX_LENGTH}
    autocomplete="username"
    title={copy.usernameValidation}
    required
    {disabled}
  />
  <Field.Description>{copy.usernameValidation}</Field.Description>
</Field.Field>
