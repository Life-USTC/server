<script lang="ts">
import { Button } from "$lib/components/ui/button/index.js";
import * as Card from "$lib/components/ui/card/index.js";
import { Input } from "$lib/components/ui/input/index.js";
import SettingsAvatarPicker from "./SettingsAvatarPicker.svelte";
import type { SettingsCopy, SettingsUser } from "./settings-component-types";

export let avatarOptions: string[];
export let copy: SettingsCopy;
export let currentImage: string;
export let isMounted: boolean;
export let previewImage: string;
export let selectedImage: string | undefined;
export let user: SettingsUser;
</script>

<form method="POST" action="?/updateProfile&tab=profile">
  <Card.Root class="border-base-300 bg-base-100">
    <Card.Header>
      <Card.Title>{copy.profile.editProfile}</Card.Title>
      <Card.Description>
        {copy.profile.editProfileDescription}
      </Card.Description>
    </Card.Header>

    <Card.Content class="grid gap-5">
      <SettingsAvatarPicker
        {avatarOptions}
        {copy}
        {currentImage}
        {isMounted}
        {previewImage}
        bind:selectedImage
        {user}
      />

      <div class="grid gap-4 md:grid-cols-2">
        <label class="grid gap-2">
          <span class="font-medium text-sm">
            {copy.profile.name} <span class="text-error">*</span>
          </span>
          <Input
            id="name"
            name="name"
            value={user.name ?? ""}
            placeholder={copy.profile.namePlaceholder}
            autocomplete="name"
            required
            disabled={!isMounted}
          />
        </label>

        <label class="grid gap-2">
          <span class="font-medium text-sm">
            {copy.profile.username}
          </span>
          <Input
            id="username"
            name="username"
            value={user.username ?? ""}
            placeholder={copy.profile.usernamePlaceholder}
            pattern="[a-z0-9-]+"
            maxlength="20"
            autocomplete="username"
            title={copy.profile.usernameValidation}
            disabled={!isMounted}
          />
          <span class="text-base-content/60 text-xs">
            {copy.profile.usernameValidation}
          </span>
        </label>
      </div>
    </Card.Content>

    <Card.Footer>
      <Button class="w-fit" type="submit" disabled={!isMounted}>{copy.profile.save}</Button>
    </Card.Footer>
  </Card.Root>
</form>
