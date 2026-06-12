<script lang="ts">
import type { SubmitFunction } from "@sveltejs/kit";
import AdminModerationCommentDialog from "@/features/admin/components/AdminModerationCommentDialog.svelte";
import AdminModerationDeleteHomeworkDialog from "@/features/admin/components/AdminModerationDeleteHomeworkDialog.svelte";
import AdminModerationDescriptionDialog from "@/features/admin/components/AdminModerationDescriptionDialog.svelte";
import type { AdminModerationComment } from "@/features/admin/components/admin-moderation-comment-types";
import type { AdminModerationDescription } from "@/features/admin/components/admin-moderation-description-types";
import type {
  AdminModerationCopy,
  AdminModerationDurationOption,
  AdminModerationHomework,
  AdminModerationStatusOptions,
} from "@/features/admin/components/admin-moderation-page-types";
import {
  moderationCommentAuthorLabel,
  moderationDescriptionEditedAt,
  moderationDescriptionTargetHref,
  moderationFormatMessage,
  moderationTargetHref,
  moderationTargetLabel,
} from "@/features/admin/lib/moderation-display";

export let closeCommentDialog: () => void;
export let closeDescriptionDialog: () => void;
export let commentStatus: "active" | "softbanned" | "deleted";
export let commentStatusOptions: AdminModerationStatusOptions;
export let copy: AdminModerationCopy;
export let customExpiresAt: string;
export let descriptionDraft: string;
export let dialogMessage: string;
export let editDescriptionAction: SubmitFunction;
export let formatDate: (value: string | Date) => string;
export let inputValue: (event: Event) => string;
export let isDeletingHomework: boolean;
export let isSavingComment: boolean;
export let isSavingDescription: boolean;
export let isSuspendingUser: boolean;
export let moderationNote: string;
export let pendingDeleteHomework: AdminModerationHomework | null;
export let saveCommentModeration: () => void;
export let setPendingDeleteHomework: (
  homework: AdminModerationHomework | null,
) => void;
export let suspensionDuration: string;
export let suspensionDurationOptions: AdminModerationDurationOption[];
export let suspensionReason: string;
export let suspendCommentAuthor: () => void;
export let selectedComment: AdminModerationComment | null;
export let selectedDescription: AdminModerationDescription | null;
export let deleteHomeworkAction: SubmitFunction;
</script>

<AdminModerationCommentDialog
  bind:commentStatus
  bind:customExpiresAt
  bind:moderationNote
  bind:suspensionDuration
  bind:suspensionReason
  close={closeCommentDialog}
  comment={selectedComment}
  commentAuthorLabel={(comment) => moderationCommentAuthorLabel(comment, copy.guestLabel)}
  {commentStatusOptions}
  {copy}
  {dialogMessage}
  {inputValue}
  {isSavingComment}
  {isSuspendingUser}
  {saveCommentModeration}
  {suspendCommentAuthor}
  {suspensionDurationOptions}
  targetHref={moderationTargetHref}
  targetLabel={(item) => moderationTargetLabel(item, copy)}
/>

<AdminModerationDeleteHomeworkDialog
  close={() => {
    setPendingDeleteHomework(null);
  }}
  {copy}
  enhanceDeleteHomework={deleteHomeworkAction}
  formatMessage={moderationFormatMessage}
  homework={pendingDeleteHomework}
  isDeleting={isDeletingHomework}
/>

<AdminModerationDescriptionDialog
  bind:descriptionDraft
  close={closeDescriptionDialog}
  {copy}
  description={selectedDescription}
  descriptionEditedAt={moderationDescriptionEditedAt}
  descriptionTargetHref={moderationDescriptionTargetHref}
  enhanceAction={editDescriptionAction}
  {formatDate}
  formatMessage={moderationFormatMessage}
  {inputValue}
  isSaving={isSavingDescription}
  targetLabel={(item) => moderationTargetLabel(item, copy)}
/>
