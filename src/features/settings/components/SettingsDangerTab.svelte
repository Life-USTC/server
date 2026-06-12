<script lang="ts">
import { enhance } from "$app/forms";
import { Button } from "$lib/components/ui/button/index.js";
import * as Card from "$lib/components/ui/card/index.js";
import * as Dialog from "$lib/components/ui/dialog/index.js";
import { Input } from "$lib/components/ui/input/index.js";
import type {
  SettingsCopy,
  SettingsDeleteAccountAction,
} from "./settings-component-types";

export let copy: SettingsCopy;
export let deleteAccountAction: SettingsDeleteAccountAction;
export let deleteConfirmValue: string;
export let isDeleteAccountOpen: boolean;
export let isDeletingAccount: boolean;
export let isMounted: boolean;
</script>

<Card.Root class="border-error/50 bg-base-100">
  <Card.Header>
    <Card.Title class="text-error">{copy.profile.deleteAccountTitle}</Card.Title>
    <Card.Description>
      {copy.profile.deleteAccountDescription}
    </Card.Description>
  </Card.Header>
  <Card.Content class="grid gap-4">
    <Button
      class="w-fit"
      type="button"
      disabled={!isMounted}
      variant="destructive"
      onclick={() => {
        isDeleteAccountOpen = true;
        deleteConfirmValue = "";
      }}
    >
      {copy.profile.deleteAccount}
    </Button>
    {#if isDeleteAccountOpen}
      <Dialog.Root
        open={true}
        class="max-w-md border-error/40"
        onOpenChange={(open) => {
          if (!open) {
            isDeleteAccountOpen = false;
            deleteConfirmValue = "";
          }
        }}
      >
        <Dialog.Header>
          <Dialog.Title class="text-error">{copy.profile.deleteAccountConfirmTitle}</Dialog.Title>
          <Dialog.Description>
            {copy.profile.deleteAccountConfirmDescription}
          </Dialog.Description>
        </Dialog.Header>
        <form
          method="POST"
          action="?/deleteAccount&tab=danger"
          class="grid gap-4 px-5 py-4"
          use:enhance={deleteAccountAction}
        >
          <label class="grid gap-2">
            <span class="text-base-content/60 text-sm">
              {copy.profile.deleteAccountConfirmPrompt.replace("{phrase}", "DELETE")}
            </span>
            <Input
              name="confirm"
              placeholder="DELETE"
              pattern="DELETE"
              required
              disabled={!isMounted || isDeletingAccount}
              bind:value={deleteConfirmValue}
            />
          </label>
          <Dialog.Footer class="px-0 pb-0">
            <Button
              variant="secondary"
              type="button"
              disabled={isDeletingAccount}
              onclick={() => {
                isDeleteAccountOpen = false;
                deleteConfirmValue = "";
              }}
            >
              {copy.profile.cancel}
            </Button>
            <Button
              type="submit"
              disabled={!isMounted || isDeletingAccount || deleteConfirmValue !== "DELETE"}
              variant="destructive"
            >
              {copy.profile.deleteAccount}
            </Button>
          </Dialog.Footer>
        </form>
      </Dialog.Root>
    {/if}
  </Card.Content>
</Card.Root>
