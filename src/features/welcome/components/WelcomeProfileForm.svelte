<script lang="ts">
import {
  PROFILE_USERNAME_MAX_LENGTH,
  PROFILE_USERNAME_PATTERN,
} from "@/features/profile/lib/profile-username";
import { enhance } from "$app/forms";
import { Alert } from "$lib/components/ui/alert/index.js";
import * as Avatar from "$lib/components/ui/avatar/index.js";
import { Badge } from "$lib/components/ui/badge/index.js";
import { Button } from "$lib/components/ui/button/index.js";
import * as Card from "$lib/components/ui/card/index.js";
import * as Field from "$lib/components/ui/field/index.js";
import { Input } from "$lib/components/ui/input/index.js";
import * as Radio from "$lib/components/ui/radio-group/index.js";
import type {
  CompleteProfileAction,
  WelcomeCopy,
  WelcomeProfileCopy,
  WelcomeProfileUser,
  WelcomeRootCopy,
} from "./welcome-component-types";

export let avatarOptions: string[];
export let callbackUrl: string;
export let completeProfileAction: CompleteProfileAction;
export let copy: WelcomeRootCopy;
export let currentImage: string;
export let formMessage: string | null | undefined;
export let isCompletingProfile: boolean;
export let previewImage: string;
export let profileCopy: WelcomeProfileCopy;
export let selectedImage: string | undefined;
export let user: WelcomeProfileUser;
export let welcomeCopy: WelcomeCopy;

$: avatarFallback = (user.name ?? user.username ?? "U")
  .slice(0, 1)
  .toUpperCase();
</script>

<form method="POST" action="?/complete" use:enhance={completeProfileAction}>
  <input type="hidden" name="callbackUrl" value={callbackUrl} />
  <Card.Root class="border-base-300 bg-base-100">
    <Card.Header class="items-center text-center">
      <Badge class="w-fit" variant="secondary">{welcomeCopy.firstSignIn}</Badge>
      <Card.Title class="text-3xl">{welcomeCopy.title}</Card.Title>
      <Card.Description>{welcomeCopy.description}</Card.Description>
    </Card.Header>

    <Card.Content class="grid gap-6">
      {#if formMessage}
        <Alert variant="destructive">
          <span>{formMessage}</span>
        </Alert>
      {/if}

      <Radio.Root
        class="grid gap-3"
        data-testid="avatar-selector"
        bind:value={selectedImage}
      >
        {#if selectedImage && selectedImage !== currentImage}
          <input type="hidden" name="image" value={selectedImage} />
        {/if}
        <legend class="font-medium text-sm">{profileCopy.profilePicture}</legend>
        <div class="flex items-center gap-4">
          <Avatar.Root class="size-20">
            <Avatar.Image alt={profileCopy.profilePicture} src={previewImage} />
            <Avatar.Fallback>{avatarFallback}</Avatar.Fallback>
          </Avatar.Root>
          {#if avatarOptions.length > 0}
            <div class="grid grid-cols-4 gap-2">
              {#each avatarOptions as avatar, index}
                <Radio.Item
                  class="rounded-full"
                  value={avatar}
                  aria-label={`${copy.accessibility.avatarOption} ${index + 1}`}
                >
                  <Avatar.Root class="size-12 border-0">
                    <Avatar.Image alt={copy.accessibility.avatarOption} src={avatar} />
                    <Avatar.Fallback>{index + 1}</Avatar.Fallback>
                  </Avatar.Root>
                </Radio.Item>
              {/each}
            </div>
          {:else}
            <p class="text-base-content/60 text-sm">
              {welcomeCopy.avatarLater}
            </p>
          {/if}
        </div>
      </Radio.Root>

      <Field.Group class="gap-4">
        <Field.Field>
          <Field.Label for="name">{profileCopy.name} <span class="text-error">*</span></Field.Label>
          <Input id="name" name="name" value={user.name ?? ""} placeholder={profileCopy.namePlaceholder} required autocomplete="name" />
        </Field.Field>

        <Field.Field>
          <Field.Label for="username">{profileCopy.username} <span class="text-error">*</span></Field.Label>
          <Input id="username" name="username" value={user.username ?? ""} placeholder={profileCopy.usernamePlaceholder} pattern={PROFILE_USERNAME_PATTERN} maxlength={PROFILE_USERNAME_MAX_LENGTH} required autocomplete="username" title={profileCopy.usernameValidation} />
          <Field.Description>{profileCopy.usernameValidation}</Field.Description>
        </Field.Field>
      </Field.Group>

      <Button class="w-full" type="submit" disabled={isCompletingProfile}>
        {isCompletingProfile ? profileCopy.saving : welcomeCopy.continue}
      </Button>
    </Card.Content>
  </Card.Root>
</form>
