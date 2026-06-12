<script lang="ts">
import * as Avatar from "$lib/components/ui/avatar/index.js";
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

<Radio.Root class="grid gap-3" disabled={!isMounted} bind:value={selectedImage}>
  {#if selectedImage && selectedImage !== currentImage}
    <input type="hidden" name="image" value={selectedImage} />
  {/if}
  <legend class="font-medium text-sm">{copy.profile.profilePicture}</legend>
  <div class="flex items-center gap-4">
    <Avatar.Root class="h-20 w-20">
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
          <Radio.Item
            aria-label={`${copy.accessibility.avatarOption} ${index + 1}`}
            class="rounded-full"
            value={avatar}
            disabled={!isMounted}
          >
            <Avatar.Root class="h-12 w-12 border-0">
              <Avatar.Image alt={copy.accessibility.avatarOption} src={avatar} />
            </Avatar.Root>
          </Radio.Item>
        {/each}
      </div>
    {/if}
  </div>
</Radio.Root>
