<script lang="ts">
import { enhance } from "$app/forms";
import { Button, buttonVariants } from "$lib/components/ui/button/index.js";
import * as Dialog from "$lib/components/ui/dialog/index.js";
import * as Field from "$lib/components/ui/field/index.js";
import { Input } from "$lib/components/ui/input/index.js";
import { Spinner } from "$lib/components/ui/spinner/index.js";
import { cn } from "$lib/utils.js";
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

<section
  aria-labelledby="settings-danger-title"
  class="grid gap-4"
  data-settings-danger-region
>
  <div class="grid gap-1">
    <h2 class="text-destructive text-base font-normal tracking-tight" id="settings-danger-title">
      {copy.profile.deleteAccountTitle}
    </h2>
    <p class="text-muted-foreground text-sm">
      {copy.profile.deleteAccountDescription}
    </p>
  </div>

  <Dialog.Root
    open={isDeleteAccountOpen}
    onOpenChange={(open) => {
      if (!open && isDeletingAccount) return;
      isDeleteAccountOpen = open;
      deleteConfirmValue = "";
    }}
  >
    <Dialog.Trigger
      type="button"
      class={cn(buttonVariants({ variant: "destructive" }), "w-fit")}
      disabled={!isMounted}
    >
      {copy.profile.deleteAccount}
    </Dialog.Trigger>

    <Dialog.Content class="max-w-md sm:max-w-md">
      <form
        method="POST"
        action="?/deleteAccount"
        use:enhance={deleteAccountAction}
      >
        <Field.Group class="gap-4">
          <Dialog.Header>
            <Dialog.Title>{copy.profile.deleteAccountConfirmTitle}</Dialog.Title>
            <Dialog.Description>
              {copy.profile.deleteAccountConfirmDescription}
            </Dialog.Description>
          </Dialog.Header>

          <Field.Field>
            <Field.Label for="delete-confirm">
              {copy.profile.deleteAccountConfirmPrompt.replace("{phrase}", "DELETE")}
            </Field.Label>
            <Input
              id="delete-confirm"
              name="confirm"
              placeholder="DELETE"
              pattern="DELETE"
              required
              disabled={!isMounted || isDeletingAccount}
              bind:value={deleteConfirmValue}
            />
          </Field.Field>

          <Dialog.Footer>
            <Dialog.Close
              type="button"
              class={buttonVariants({ variant: "secondary" })}
              disabled={isDeletingAccount}
            >
              {copy.profile.cancel}
            </Dialog.Close>
            <Button
              type="submit"
              disabled={!isMounted || isDeletingAccount || deleteConfirmValue !== "DELETE"}
              variant="destructive"
            >
              {#if isDeletingAccount}
                <Spinner data-icon="inline-start" />
              {/if}
              {copy.profile.deleteAccount}
            </Button>
          </Dialog.Footer>
        </Field.Group>
      </form>
    </Dialog.Content>
  </Dialog.Root>
</section>
