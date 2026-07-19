<script lang="ts">
import {
  PROFILE_USERNAME_MAX_LENGTH,
  PROFILE_USERNAME_PATTERN,
} from "@/features/profile/lib/profile-username";
import { Button } from "$lib/components/ui/button/index.js";
import * as Card from "$lib/components/ui/card/index.js";
import * as Field from "$lib/components/ui/field/index.js";
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

<form method="POST" action="?/updateProfile">
  <Card.Root>
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

      <Field.Group class="grid gap-4 md:grid-cols-2">
        <Field.Field data-disabled={!isMounted ? "true" : undefined}>
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
            disabled={!isMounted}
          />
        </Field.Field>

        <Field.Field data-disabled={!isMounted ? "true" : undefined}>
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
            disabled={!isMounted}
          />
          <Field.Description>
            {copy.profile.usernameValidation}
          </Field.Description>
        </Field.Field>
      </Field.Group>
    </Card.Content>

    <Card.Footer>
      <Button class="w-fit" type="submit" disabled={!isMounted}>{copy.profile.save}</Button>
    </Card.Footer>
  </Card.Root>
</form>
