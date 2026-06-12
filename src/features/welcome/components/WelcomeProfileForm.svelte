<script lang="ts">
import { enhance } from "$app/forms";
import { Alert } from "$lib/components/ui/alert/index.js";
import * as Avatar from "$lib/components/ui/avatar/index.js";
import { Badge } from "$lib/components/ui/badge/index.js";
import { Button } from "$lib/components/ui/button/index.js";
import * as Card from "$lib/components/ui/card/index.js";
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
</script>

<form method="POST" action="?/complete" use:enhance={completeProfileAction}>
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
          <Avatar.Root class="h-20 w-20">
            <Avatar.Image alt={profileCopy.profilePicture} src={previewImage} />
          </Avatar.Root>
          {#if avatarOptions.length > 0}
            <div class="grid grid-cols-4 gap-2">
              {#each avatarOptions as avatar, index}
                <Radio.Item
                  class="rounded-full"
                  value={avatar}
                  aria-label={`${copy.accessibility.avatarOption} ${index + 1}`}
                >
                  <Avatar.Root class="h-12 w-12 border-0">
                    <Avatar.Image alt={copy.accessibility.avatarOption} src={avatar} />
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

      <label class="grid gap-2">
        <span class="font-medium text-sm">{profileCopy.name} <span class="text-error">*</span></span>
        <Input id="name" name="name" value={user.name ?? ""} placeholder={profileCopy.namePlaceholder} required autocomplete="name" />
      </label>

      <label class="grid gap-2">
        <span class="font-medium text-sm">{profileCopy.username} <span class="text-error">*</span></span>
        <Input id="username" name="username" value={user.username ?? ""} placeholder={profileCopy.usernamePlaceholder} pattern="[a-z0-9-]+" maxlength="20" required autocomplete="username" title={profileCopy.usernameValidation} />
        <span class="text-base-content/60 text-xs">{profileCopy.usernameValidation}</span>
      </label>

      <Button class="w-full" type="submit" disabled={isCompletingProfile}>
        {isCompletingProfile ? profileCopy.saving : welcomeCopy.continue}
      </Button>
    </Card.Content>
  </Card.Root>
</form>
