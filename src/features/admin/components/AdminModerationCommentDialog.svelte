<script lang="ts">
import { Alert } from "$lib/components/ui/alert/index.js";
import { Button } from "$lib/components/ui/button/index.js";
import * as Dialog from "$lib/components/ui/dialog/index.js";
import AdminModerationCommentPreview from "./AdminModerationCommentPreview.svelte";
import AdminModerationCommentStatusSection from "./AdminModerationCommentStatusSection.svelte";
import AdminModerationCommentSuspensionSection from "./AdminModerationCommentSuspensionSection.svelte";
import type { AdminModerationComment } from "./admin-moderation-comment-types";
import type {
  AdminModerationCopy,
  AdminModerationDurationOption,
  AdminModerationStatusOptions,
} from "./admin-moderation-page-types";

export let close: () => void;
export let comment: AdminModerationComment | null;
export let commentAuthorLabel: (comment: AdminModerationComment) => string;
export let commentStatus: "active" | "softbanned" | "deleted";
export let commentStatusOptions: AdminModerationStatusOptions;
export let copy: AdminModerationCopy;
export let customExpiresAt: string;
export let dialogMessage: string;
export let inputValue: (event: Event) => string;
export let isSavingComment: boolean;
export let isSuspendingUser: boolean;
export let moderationNote: string;
export let saveCommentModeration: () => void;
export let suspendCommentAuthor: () => void;
export let suspensionDuration: string;
export let suspensionDurationOptions: AdminModerationDurationOption[];
export let suspensionReason: string;
export let targetHref: (comment: AdminModerationComment) => string;
export let targetLabel: (comment: AdminModerationComment) => string;
</script>

{#if comment}
  <Dialog.Root
    open={true}
    class="max-w-2xl"
    aria-labelledby="manage-comment-title"
    onOpenChange={(open) => {
      if (!open) close();
    }}
  >
    <Dialog.Header>
      <div class="flex items-start justify-between gap-3">
        <div>
          <Dialog.Title id="manage-comment-title">{copy.manageComment}</Dialog.Title>
          <Dialog.Description>
            {commentAuthorLabel(comment)} · {targetLabel(comment)}
          </Dialog.Description>
        </div>
        <Button size="sm" type="button" variant="ghost" onclick={close}>{copy.close}</Button>
      </div>
    </Dialog.Header>

    <div class="grid max-h-[calc(100vh-2rem)] gap-5 overflow-y-auto px-5 py-4">
      {#if dialogMessage}<Alert class="py-2" variant="info">{dialogMessage}</Alert>{/if}

      <AdminModerationCommentPreview
        {comment}
        {copy}
        {targetHref}
      />

      <AdminModerationCommentStatusSection
        bind:commentStatus
        {commentStatusOptions}
        {copy}
        {inputValue}
        bind:moderationNote
      />

      <AdminModerationCommentSuspensionSection
        {comment}
        {copy}
        bind:customExpiresAt
        {inputValue}
        {isSuspendingUser}
        {suspendCommentAuthor}
        bind:suspensionDuration
        {suspensionDurationOptions}
        bind:suspensionReason
      />
    </div>

    <Dialog.Footer>
      <Button type="button" variant="ghost" onclick={close}>{copy.cancelButton}</Button>
      <Button disabled={isSavingComment} type="button" onclick={saveCommentModeration}>
        {isSavingComment ? copy.saving : copy.confirmButton}
      </Button>
    </Dialog.Footer>
  </Dialog.Root>
{/if}
