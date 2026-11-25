<script lang="ts">
import { onDestroy } from "svelte";
import * as Alert from "#lib/components/ui/alert/index.js";
import { Badge } from "#lib/components/ui/badge/index.js";
import { Button } from "#lib/components/ui/button/index.js";
import * as Card from "#lib/components/ui/card/index.js";
import * as Field from "#lib/components/ui/field/index.js";
import { Input } from "#lib/components/ui/input/index.js";
import ProfileAvatarPicker from "@/features/profile/components/ProfileAvatarPicker.svelte";
import ProfileIdentityFields from "@/features/profile/components/ProfileIdentityFields.svelte";
import type { SubmitFunction } from "$app/forms";
import { enhance } from "$app/forms";
import type { WelcomePageData } from "./welcome-component-types";

export let data: WelcomePageData;
export let completeProfileAction: SubmitFunction;
export let formMessage: string | null | undefined;
export let isCompletingProfile: boolean;
export let selectedImage: string | undefined;

$: user = data.user;
$: profileCopy = data.copy.profile;
$: welcomeCopy = data.copy.welcome;
$: currentImage = user.image ?? "";
$: previewImage = selectedImage || currentImage || "/images/icon.png";

let uploadedAvatarPreview = "";

function handleAvatarUpload(event: Event) {
  if (uploadedAvatarPreview) URL.revokeObjectURL(uploadedAvatarPreview);
  const input = event.currentTarget as HTMLInputElement;
  const file = input.files?.[0];
  uploadedAvatarPreview = file ? URL.createObjectURL(file) : "";
  if (file) selectedImage = undefined;
}

onDestroy(() => {
  if (uploadedAvatarPreview) URL.revokeObjectURL(uploadedAvatarPreview);
});
</script>

<form method="POST" action="?/complete" enctype="multipart/form-data" use:enhance={completeProfileAction}>
  <input type="hidden" name="callbackUrl" value={data.callbackUrl} />
  <Card.Root>
    <Card.Header class="items-center text-center">
      <Badge class="w-fit" variant="secondary">{welcomeCopy.firstSignIn}</Badge>
      <Card.Title aria-level={1} role="heading">{welcomeCopy.title}</Card.Title>
      <Card.Description>{welcomeCopy.description}</Card.Description>
    </Card.Header>

    <Card.Content class="grid gap-6">
      {#if formMessage}
        <Alert.Root variant="destructive">
          <Alert.Description>{formMessage}</Alert.Description>
        </Alert.Root>
      {/if}

      <ProfileAvatarPicker
        avatarOptions={user.profilePictures}
        label={profileCopy.profilePicture}
        avatarOptionLabel={data.copy.accessibility.avatarOption}
        {currentImage}
        previewImage={uploadedAvatarPreview || previewImage}
        bind:selectedImage
        {user}
        emptyDescription={welcomeCopy.avatarLater}
        selectorTestId="avatar-selector"
      >
        <Field.Field for="avatar" label={profileCopy.avatarUpload}>
          <Input
            id="avatar"
            name="avatar"
            type="file"
            accept="image/avif,image/jpeg,image/png,image/webp"
            onchange={handleAvatarUpload}
          />
          <Field.Description>{profileCopy.avatarUploadHint}</Field.Description>
        </Field.Field>
      </ProfileAvatarPicker>

      <Field.Group class="gap-4">
        <ProfileIdentityFields copy={profileCopy} {user} />
      </Field.Group>

      <Button loading={isCompletingProfile} class="w-full" type="submit" disabled={isCompletingProfile}>
        {isCompletingProfile ? profileCopy.saving : welcomeCopy.continue}
      </Button>
    </Card.Content>
  </Card.Root>
</form>
