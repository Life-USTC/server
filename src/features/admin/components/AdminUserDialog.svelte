<script lang="ts">
import CheckCircleIcon from "@lucide/svelte/icons/check-circle";
import AdminUserDialogHeader from "@/features/admin/components/AdminUserDialogHeader.svelte";
import AdminUserProfileSection from "@/features/admin/components/AdminUserProfileSection.svelte";
import AdminUserSuspensionSection from "@/features/admin/components/AdminUserSuspensionSection.svelte";
import * as Alert from "$lib/components/ui/alert/index.js";
import { Button } from "$lib/components/ui/button/index.js";
import * as Dialog from "$lib/components/ui/dialog/index.js";
import { ScrollArea } from "$lib/components/ui/scroll-area/index.js";
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
export let moderationCopy: AdminUsersModerationCopy;
export let saveSelectedUser: () => void | Promise<void>;
export let selectedUser: AdminUserRow | null;
export let suspendDuration: string;
export let suspendDurationOptions: Array<{ label: string; value: string }>;
export let suspendExpiresAt: string;
export let suspendReason: string;
export let suspendSelectedUser: () => void | Promise<void>;
export let suspensionLabel: AdminUserFormatter;
</script>

{#if selectedUser}
  <Dialog.Root
    open={true}
    onOpenChange={(open) => {
      if (!open) close();
    }}
  >
    <Dialog.Content
      class="max-w-2xl"
      aria-labelledby="admin-user-dialog-title"
    >
      <AdminUserDialogHeader {copy} user={selectedUser} />

      <ScrollArea class="h-[min(62vh,34rem)]">
        <div class="grid gap-5 px-5 py-4">
          {#if message}<Alert.Root><Alert.Description>{message}</Alert.Description></Alert.Root>{/if}

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
        <Button type="button" disabled={isSaving} onclick={saveSelectedUser}>
          <CheckCircleIcon data-icon="inline-start" />
          <span>{isSaving ? copy.saving : copy.saveAction}</span>
        </Button>
      </Dialog.Footer>
    </Dialog.Content>
  </Dialog.Root>
{/if}
