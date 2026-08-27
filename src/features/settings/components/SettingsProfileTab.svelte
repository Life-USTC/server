<script lang="ts">
import type { SubmitFunction } from "@sveltejs/kit";
import {
  PROFILE_USERNAME_MAX_LENGTH,
  PROFILE_USERNAME_PATTERN,
} from "@/features/profile/lib/profile-username";
import { enhance } from "$app/forms";
import { Button } from "$lib/components/ui/button/index.js";
import * as Field from "$lib/components/ui/field/index.js";
import { Input } from "$lib/components/ui/input/index.js";
import { Spinner } from "$lib/components/ui/spinner/index.js";
import SettingsAvatarPicker from "./SettingsAvatarPicker.svelte";
import type { SettingsCopy, SettingsUser } from "./settings-component-types";

export let avatarOptions: string[];
export let copy: SettingsCopy;
export let currentImage: string;
export let isMounted: boolean;
export let previewImage: string;
export let selectedImage: string | undefined;
export let user: SettingsUser;

let saving = false;

const updateProfile: SubmitFunction = () => {
  saving = true;
  return async ({ update }) => {
    try {
      await update();
    } finally {
      saving = false;
    }
  };
};
</script>

<form
  class="grid gap-5"
  method="POST"
  action="?/updateProfile"
  use:enhance={updateProfile}
>
  <div class="grid gap-1">
    <h2 class="text-base font-normal tracking-tight">{copy.profile.editProfile}</h2>
    <p class="text-muted-foreground text-sm">
      {copy.profile.editProfileDescription}
    </p>
  </div>

  <SettingsAvatarPicker
    {avatarOptions}
    {copy}
    {currentImage}
    {isMounted}
    {previewImage}
    bind:selectedImage
    {user}
  />

  <Field.Group class="grid gap-4 md:grid-cols-2">
    <Field.Field data-disabled={!isMounted || saving ? "true" : undefined}>
      <Field.Label for="name">
        {copy.profile.name} <span class="text-destructive">*</span>
      </Field.Label>
      <Input
        id="name"
        name="name"
        value={user.name ?? ""}
        placeholder={copy.profile.namePlaceholder}
        autocomplete="name"
        required
        disabled={!isMounted || saving}
      />
    </Field.Field>

    <Field.Field data-disabled={!isMounted || saving ? "true" : undefined}>
      <Field.Label for="username">
        {copy.profile.username}
      </Field.Label>
      <Input
        id="username"
        name="username"
        value={user.username ?? ""}
        placeholder={copy.profile.usernamePlaceholder}
        pattern={PROFILE_USERNAME_PATTERN}
        maxlength={PROFILE_USERNAME_MAX_LENGTH}
        autocomplete="username"
        title={copy.profile.usernameValidation}
        required
        disabled={!isMounted || saving}
      />
      <Field.Description>
        {copy.profile.usernameValidation}
      </Field.Description>
    </Field.Field>
  </Field.Group>

  <Button class="w-fit" type="submit" disabled={!isMounted || saving}>
    {#if saving}<Spinner data-icon="inline-start" />{/if}
    {saving ? copy.profile.pleaseWait : copy.profile.save}
  </Button>
</form>
