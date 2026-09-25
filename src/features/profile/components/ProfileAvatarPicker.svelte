<script lang="ts">
import type { Snippet } from "svelte";
import * as Avatar from "$lib/components/ui/avatar/index.js";
import * as Field from "$lib/components/ui/field/index.js";
import * as ToggleGroup from "$lib/components/ui/toggle-group/index.js";
import type { ProfileFormUser } from "./profile-form-types";

export let avatarOptions: string[];
export let label: string;
export let avatarOptionLabel: string;
export let currentImage: string;
export let disabled = false;
export let emptyDescription: string | undefined = undefined;
export let previewTestId: string | undefined = undefined;
export let selectorTestId: string | undefined = undefined;
export let children: Snippet | undefined = undefined;
export let previewImage: string;
export let selectedImage: string | undefined;
export let user: ProfileFormUser;
</script>

{#if selectedImage && selectedImage !== currentImage}
  <input type="hidden" name="image" value={selectedImage} />
{/if}
<Field.Set data-disabled={disabled ? "true" : undefined}>
  <Field.Legend variant="label">{label}</Field.Legend>
  <div class="flex flex-wrap items-center gap-4">
    <Avatar.Root class="size-20 shrink-0">
      <Avatar.Image
        alt={label}
        data-testid={previewTestId}
        src={previewImage}
      />
      <Avatar.Fallback>
        {(user.name ?? user.username ?? "U").slice(0, 1).toUpperCase()}
      </Avatar.Fallback>
    </Avatar.Root>

    {#if avatarOptions.length > 0}
      <ToggleGroup.Root
        type="single"
        aria-label={label}
        data-testid={selectorTestId}
        class="flex flex-wrap"
        disabled={disabled}
        spacing={2}
        variant="outline"
        bind:value={selectedImage}
      >
        {#each avatarOptions as avatar, index}
          <ToggleGroup.Item
            aria-label={`${avatarOptionLabel} ${index + 1}`}
            class="size-12 rounded-full p-0 data-[state=on]:ring-2 data-[state=on]:ring-primary data-[state=on]:ring-offset-2"
            disabled={disabled}
            value={avatar}
          >
            <Avatar.Root class="size-full">
              <Avatar.Image alt={avatarOptionLabel} src={avatar} />
              <Avatar.Fallback>{index + 1}</Avatar.Fallback>
            </Avatar.Root>
          </ToggleGroup.Item>
        {/each}
      </ToggleGroup.Root>
    {:else if emptyDescription}
      <Field.Description>{emptyDescription}</Field.Description>
    {/if}
  </div>
  {@render children?.()}
</Field.Set>
