<script lang="ts">
import { enhance } from "$app/forms";
import * as AlertDialog from "$lib/components/ui/alert-dialog/index.js";
import { Button } from "$lib/components/ui/button/index.js";
import * as Card from "$lib/components/ui/card/index.js";
import * as Field from "$lib/components/ui/field/index.js";
import { Input } from "$lib/components/ui/input/index.js";
import { Spinner } from "$lib/components/ui/spinner/index.js";
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

<Card.Root>
  <Card.Header>
    <Card.Title>{copy.profile.deleteAccountTitle}</Card.Title>
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
      <AlertDialog.Root
        open={true}
        onOpenChange={(open) => {
          if (!open) {
            isDeleteAccountOpen = false;
            deleteConfirmValue = "";
          }
        }}
      >
        <AlertDialog.Content class="max-w-md sm:max-w-md">
          <AlertDialog.Header>
            <AlertDialog.Title>{copy.profile.deleteAccountConfirmTitle}</AlertDialog.Title>
            <AlertDialog.Description>
              {copy.profile.deleteAccountConfirmDescription}
            </AlertDialog.Description>
          </AlertDialog.Header>
          <form
            method="POST"
            action="?/deleteAccount&tab=danger"
            class="flex flex-col gap-4 px-5 py-4"
            use:enhance={deleteAccountAction}
          >
            <Field.Group>
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
            </Field.Group>
            <AlertDialog.Footer class="px-0 pb-0">
              <AlertDialog.Cancel
                variant="secondary"
                type="button"
                disabled={isDeletingAccount}
              >
                {copy.profile.cancel}
              </AlertDialog.Cancel>
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
            </AlertDialog.Footer>
          </form>
        </AlertDialog.Content>
      </AlertDialog.Root>
    {/if}
  </Card.Content>
</Card.Root>
