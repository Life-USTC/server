<script lang="ts">
import type { SubmitFunction } from "@sveltejs/kit";
import ProfileAvatarPicker from "@/features/profile/components/ProfileAvatarPicker.svelte";
import ProfileIdentityFields from "@/features/profile/components/ProfileIdentityFields.svelte";
import { enhance } from "$app/forms";
import { Button } from "$lib/components/ui/button/index.js";
import * as Field from "$lib/components/ui/field/index.js";
import { Spinner } from "$lib/components/ui/spinner/index.js";
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

  <ProfileAvatarPicker
    {avatarOptions}
    label={copy.profile.profilePicture}
    avatarOptionLabel={copy.accessibility.avatarOption}
    previewTestId="current-avatar"
    {currentImage}
    disabled={!isMounted}
    {previewImage}
    bind:selectedImage
    {user}
  />

  <Field.Group class="grid gap-4 md:grid-cols-2">
    <ProfileIdentityFields
      copy={copy.profile}
      {user}
      disabled={!isMounted || saving}
      showUsernameRequiredIndicator={false}
    />
  </Field.Group>

  <Button class="w-fit" type="submit" disabled={!isMounted || saving}>
    {#if saving}<Spinner data-icon="inline-start" />{/if}
    {saving ? copy.profile.pleaseWait : copy.profile.save}
  </Button>
</form>
