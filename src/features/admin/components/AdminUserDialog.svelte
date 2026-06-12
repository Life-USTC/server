<script lang="ts">
import AdminUserDialogHeader from "@/features/admin/components/AdminUserDialogHeader.svelte";
import AdminUserProfileSection from "@/features/admin/components/AdminUserProfileSection.svelte";
import AdminUserSuspensionSection from "@/features/admin/components/AdminUserSuspensionSection.svelte";
import CheckCircleIcon from "$lib/components/icons/check-circle.svelte";
import { Alert } from "$lib/components/ui/alert/index.js";
import { Button } from "$lib/components/ui/button/index.js";
import * as Dialog from "$lib/components/ui/dialog/index.js";
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
    class="max-w-2xl"
    aria-labelledby="admin-user-dialog-title"
    onOpenChange={(open) => {
      if (!open) close();
    }}
  >
    <AdminUserDialogHeader {copy} user={selectedUser} />

    <div class="grid max-h-[calc(100vh-2rem)] gap-5 overflow-y-auto px-5 py-4">
      {#if message}<Alert>{message}</Alert>{/if}

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

    <Dialog.Footer>
      <Button type="button" variant="outline" onclick={close}>
        {moderationCopy.cancelButton}
      </Button>
      <Button type="button" disabled={isSaving} onclick={saveSelectedUser}>
        <CheckCircleIcon />
        <span>{isSaving ? copy.saving : copy.saveAction}</span>
      </Button>
    </Dialog.Footer>
  </Dialog.Root>
{/if}
