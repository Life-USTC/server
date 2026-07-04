<script lang="ts">
import * as Avatar from "$lib/components/ui/avatar/index.js";
import * as Field from "$lib/components/ui/field/index.js";
import * as Radio from "$lib/components/ui/radio-group/index.js";
import type { SettingsCopy, SettingsUser } from "./settings-component-types";

export let avatarOptions: string[];
export let copy: SettingsCopy;
export let currentImage: string;
export let isMounted: boolean;
export let previewImage: string;
export let selectedImage: string | undefined;
export let user: SettingsUser;
</script>

<Radio.Root
  aria-label={copy.profile.profilePicture}
  class="grid gap-3"
  disabled={!isMounted}
  bind:value={selectedImage}
>
  {#if selectedImage && selectedImage !== currentImage}
    <input type="hidden" name="image" value={selectedImage} />
  {/if}
  <p class="font-medium text-sm">{copy.profile.profilePicture}</p>
  <div class="flex items-center gap-4">
    <Avatar.Root class="size-20">
      <Avatar.Image
        alt={copy.profile.profilePicture}
        data-testid="current-avatar"
        src={previewImage}
      />
      <Avatar.Fallback>
        {(user.name ?? user.username ?? "U").slice(0, 1).toUpperCase()}
      </Avatar.Fallback>
    </Avatar.Root>
    {#if avatarOptions.length > 0}
      <div class="grid grid-cols-4 gap-2">
        {#each avatarOptions as avatar, index}
          {@const avatarId = `settings-avatar-option-${index}`}
          <Field.Label for={avatarId}>
            <Field.Field orientation="horizontal">
              <Avatar.Root class="size-12 border-0">
                <Avatar.Image alt={copy.accessibility.avatarOption} src={avatar} />
                <Avatar.Fallback>{index + 1}</Avatar.Fallback>
              </Avatar.Root>
              <Radio.Item
                id={avatarId}
                aria-label={`${copy.accessibility.avatarOption} ${index + 1}`}
                value={avatar}
                disabled={!isMounted}
              />
            </Field.Field>
          </Field.Label>
        {/each}
      </div>
    {/if}
  </div>
</Radio.Root>
