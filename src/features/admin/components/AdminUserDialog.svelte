<script lang="ts">
import CheckCircleIcon from "@lucide/svelte/icons/check-circle";
import AdminUserDialogHeader from "@/features/admin/components/AdminUserDialogHeader.svelte";
import AdminUserProfileSection from "@/features/admin/components/AdminUserProfileSection.svelte";
import AdminUserSuspensionSection from "@/features/admin/components/AdminUserSuspensionSection.svelte";
import * as Alert from "$lib/components/ui/alert/index.js";
import * as AlertDialog from "$lib/components/ui/alert-dialog/index.js";
import { Button } from "$lib/components/ui/button/index.js";
import * as Dialog from "$lib/components/ui/dialog/index.js";
import { ScrollArea } from "$lib/components/ui/scroll-area/index.js";
import { Spinner } from "$lib/components/ui/spinner/index.js";
import type {
  AdminUserFormatter,
  AdminUserRow,
  AdminUsersCopy,
  AdminUsersModerationCopy,
} from "./admin-user-types";

export let close: () => void;
export let copy: AdminUsersCopy;
export let editIsAdmin: boolean;
export let editName: string;
export let editUsername: string;
export let inputValue: (event: Event) => string;
export let isLiftingSuspension: boolean;
export let isSaving: boolean;
export let isSuspending: boolean;
export let liftSelectedSuspension: () => void | Promise<void>;
export let message: string | null;
export let messageVariant: "destructive" | "default";
export let moderationCopy: AdminUsersModerationCopy;
export let saveSelectedUser: () => void | Promise<void>;
export let selectedUser: AdminUserRow | null;
export let suspendDuration: string;
export let suspendDurationOptions: Array<{ label: string; value: string }>;
export let suspendExpiresAt: string;
export let suspendReason: string;
export let suspendSelectedUser: () => boolean | Promise<boolean>;
export let suspensionLabel: AdminUserFormatter;

let roleChangeDialogOpen = false;

$: if (!selectedUser) roleChangeDialogOpen = false;

function requestSave() {
  if (selectedUser && editIsAdmin !== selectedUser.isAdmin) {
    roleChangeDialogOpen = true;
    return;
  }
  void saveSelectedUser();
}

async function confirmRoleChange() {
  await saveSelectedUser();
}
</script>

{#if selectedUser}
  <Dialog.Root
    open={true}
    onOpenChange={(open) => {
      if (!open) close();
    }}
  >
    <Dialog.Content
      class="grid max-h-[calc(100dvh-1rem)] min-h-0 max-w-2xl grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden sm:max-w-2xl"
      aria-labelledby="admin-user-dialog-title"
    >
      <AdminUserDialogHeader {copy} user={selectedUser} />

      <ScrollArea class="min-h-0 h-[min(62dvh,34rem)] max-h-[calc(100dvh-10rem)]">
        <div class="grid gap-5 px-5 py-4">
          {#if message && messageVariant === "destructive"}<Alert.Root variant={messageVariant}><Alert.Description>{message}</Alert.Description></Alert.Root>{/if}

          <AdminUserProfileSection
            {copy}
            bind:editIsAdmin
            bind:editName
            bind:editUsername
            {inputValue}
          />

          <AdminUserSuspensionSection
            {copy}
            {inputValue}
            {isLiftingSuspension}
            {isSuspending}
            {liftSelectedSuspension}
            {moderationCopy}
            {selectedUser}
            bind:suspendDuration
            {suspendDurationOptions}
            bind:suspendExpiresAt
            bind:suspendReason
            {suspendSelectedUser}
            {suspensionLabel}
          />
        </div>
      </ScrollArea>

      <Dialog.Footer>
        <Button type="button" variant="outline" onclick={close}>
          {moderationCopy.cancelButton}
        </Button>
        <Button type="button" disabled={isSaving} onclick={requestSave}>
          {#if isSaving}
            <Spinner data-icon="inline-start" />
          {:else}
            <CheckCircleIcon data-icon="inline-start" />
          {/if}
          <span>{isSaving ? copy.saving : copy.saveAction}</span>
        </Button>
      </Dialog.Footer>
    </Dialog.Content>
  </Dialog.Root>

  <AlertDialog.Root
    open={roleChangeDialogOpen}
    onOpenChange={(open) => {
      if (!isSaving) roleChangeDialogOpen = open;
    }}
  >
    <AlertDialog.Content class="max-w-md sm:max-w-md">
      <AlertDialog.Header>
        <AlertDialog.Title>{copy.roleChangeConfirmTitle}</AlertDialog.Title>
        <AlertDialog.Description>
          {editIsAdmin
            ? copy.grantAdminConfirmDescription
            : copy.revokeAdminConfirmDescription}
        </AlertDialog.Description>
      </AlertDialog.Header>
      <AlertDialog.Footer>
        <AlertDialog.Cancel type="button" disabled={isSaving} variant="outline">
          {moderationCopy.cancelButton}
        </AlertDialog.Cancel>
        <AlertDialog.Action type="button" disabled={isSaving} onclick={confirmRoleChange}>
          {#if isSaving}<Spinner data-icon="inline-start" />{/if}
          {copy.confirmRoleChange}
        </AlertDialog.Action>
      </AlertDialog.Footer>
    </AlertDialog.Content>
  </AlertDialog.Root>
{/if}
