<script lang="ts">
import * as Avatar from "$lib/components/ui/avatar/index.js";
import * as Field from "$lib/components/ui/field/index.js";
import * as ToggleGroup from "$lib/components/ui/toggle-group/index.js";
import type { SettingsCopy, SettingsUser } from "./settings-component-types";

export let avatarOptions: string[];
export let copy: SettingsCopy;
export let currentImage: string;
export let isMounted: boolean;
export let previewImage: string;
export let selectedImage: string | undefined;
export let user: SettingsUser;
</script>

{#if selectedImage && selectedImage !== currentImage}
  <input type="hidden" name="image" value={selectedImage} />
{/if}
<Field.Set data-disabled={!isMounted ? "true" : undefined}>
  <Field.Legend variant="label">{copy.profile.profilePicture}</Field.Legend>
  <div class="flex flex-wrap items-center gap-4">
    <Avatar.Root class="size-20 shrink-0">
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
      <ToggleGroup.Root
        type="single"
        aria-label={copy.profile.profilePicture}
        class="flex flex-wrap"
        disabled={!isMounted}
        spacing={2}
        variant="outline"
        bind:value={selectedImage}
      >
        {#each avatarOptions as avatar, index}
          <ToggleGroup.Item
            aria-label={`${copy.accessibility.avatarOption} ${index + 1}`}
            class="size-12 rounded-full p-0 data-[state=on]:ring-2 data-[state=on]:ring-primary data-[state=on]:ring-offset-2"
            disabled={!isMounted}
            value={avatar}
          >
            <Avatar.Root class="size-full">
              <Avatar.Image alt={copy.accessibility.avatarOption} src={avatar} />
              <Avatar.Fallback>{index + 1}</Avatar.Fallback>
            </Avatar.Root>
          </ToggleGroup.Item>
        {/each}
      </ToggleGroup.Root>
    {/if}
  </div>
</Field.Set>
